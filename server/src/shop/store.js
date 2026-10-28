// Postgres side of the shop (user_items / user_equipped). Parameterized
// queries only. Implements the store interface used by ./service.js:
//   inventory(userId) → { coins, owned: string[], equipped: { pieces, board } } | null
//   buy(userId, itemId, price, { listPrice, salePercent }) → { status: 'bought' | 'owned' | 'insufficient' | 'nouser', coins }
//     (a purchase also writes its shop_purchases row in the same transaction)
//   equip(userId, slot, itemId | null) → boolean (false = item not owned)

export function createPgShopStore(pool) {
  async function inventory(userId) {
    const { rows } = await pool.query(
      `SELECT u.coins,
              COALESCE((SELECT array_agg(item_id ORDER BY acquired_at) FROM user_items WHERE user_id = u.id), '{}') AS owned,
              COALESCE((SELECT json_object_agg(slot, item_id) FROM user_equipped WHERE user_id = u.id), '{}') AS equipped
         FROM users u WHERE u.id = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    return { coins: rows[0].coins, owned: rows[0].owned, equipped: rows[0].equipped || {} };
  }

  /**
   * One transaction: claim the item (the primary key makes a second, even
   * concurrent, purchase a no-op), then debit the coins only if the balance
   * covers the price (CHECK coins >= 0 is the last guard). Anything that
   * fails rolls the claim back.
   */
  async function buy(userId, itemId, price, { listPrice = price, salePercent = null } = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const claim = await client.query(
        `INSERT INTO user_items (user_id, item_id)
         SELECT id, $2 FROM users WHERE id = $1
         ON CONFLICT (user_id, item_id) DO NOTHING
         RETURNING item_id`,
        [userId, itemId],
      );
      if (!claim.rowCount) {
        await client.query('ROLLBACK');
        const { rows } = await pool.query(
          `SELECT u.coins, EXISTS (SELECT 1 FROM user_items i WHERE i.user_id = u.id AND i.item_id = $2) AS owned
             FROM users u WHERE u.id = $1`,
          [userId, itemId],
        );
        if (!rows[0]) return { status: 'nouser', coins: 0 };
        return { status: rows[0].owned ? 'owned' : 'insufficient', coins: rows[0].coins };
      }
      const debit = await client.query(
        `UPDATE users SET coins = coins - $2, updated_at = now()
          WHERE id = $1 AND coins >= $2
          RETURNING coins`,
        [userId, price],
      );
      if (!debit.rowCount) {
        await client.query('ROLLBACK');
        const { rows } = await pool.query('SELECT coins FROM users WHERE id = $1', [userId]);
        return { status: 'insufficient', coins: rows[0] ? rows[0].coins : 0 };
      }
      await client.query(
        `INSERT INTO shop_purchases (user_id, item_id, price_paid, list_price, sale_percent) VALUES ($1, $2, $3, $4, $5)`,
        [userId, itemId, price, listPrice, salePercent],
      );
      await client.query('COMMIT');
      return { status: 'bought', coins: debit.rows[0].coins };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function equip(userId, slot, itemId) {
    if (itemId === null) {
      await pool.query('DELETE FROM user_equipped WHERE user_id = $1 AND slot = $2', [userId, slot]);
      return true;
    }
    // Only an owned item can be equipped (also enforced by the foreign key)
    const { rowCount } = await pool.query(
      `INSERT INTO user_equipped (user_id, slot, item_id)
       SELECT user_id, $2, item_id FROM user_items WHERE user_id = $1 AND item_id = $3
       ON CONFLICT (user_id, slot) DO UPDATE SET item_id = EXCLUDED.item_id`,
      [userId, slot, itemId],
    );
    return rowCount > 0;
  }

  return { inventory, buy, equip };
}
