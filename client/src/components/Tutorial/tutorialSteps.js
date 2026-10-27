// Text of the tutorial: one entry per step (its 3D scene has the same id in
// tutorialScenes.js), plus the small paper "extra" panel shown under the text.

import { Costs, DevList, Odds, Points, Tips, Trades, Terrains } from './TutorialExtras';

export const STEPS = [
  {
    id: 'goal',
    title: 'Tu meta: puntos de victoria',
    body: [
      'Eres un ninja que funda aldeas en una isla. Cada poblado vale 1 punto de victoria (PV) y cada ciudad vale 2.',
      'Gana quien llega primero a la meta. Suele ser 10 PV, pero el anfitrión de la sala puede elegir otra.',
    ],
    extra: Points,
  },
  {
    id: 'board',
    title: 'La isla y sus 5 recursos',
    body: [
      'La isla está hecha de casillas hexagonales. Cada terreno produce un recurso distinto.',
      'El desierto no produce nada: ahí empieza el ladrón.',
    ],
    extra: Terrains,
  },
  {
    id: 'numbers',
    title: 'Números y probabilidad',
    body: [
      'Cada terreno tiene una ficha del 2 al 12. Cuando los dados suman ese número, ese terreno produce.',
      'Los 6 y 8 (en rojo) salen muy seguido; el 2 y el 12, casi nunca. El 7 no tiene ficha: es el turno del ladrón.',
    ],
    extra: Odds,
  },
  {
    id: 'setup',
    title: 'Colocación inicial',
    body: [
      'Antes de empezar, cada jugador pone gratis 2 poblados, cada uno con un camino pegado.',
      'El orden va en serpiente: 1, 2, 3… y de vuelta …3, 2, 1. Quien pone primero, pone también último.',
      'Tu segundo poblado te da 1 recurso de cada terreno que toca.',
    ],
  },
  {
    id: 'roll',
    title: 'Tu turno: tira los dados',
    body: [
      'Cada turno empieza tirando los dos dados. Aquí salió 5 + 3 = 8.',
      'Todos los terrenos con un 8 producen, y cobran todos los que tengan un poblado en sus esquinas, sea o no su turno.',
      'Después puedes comerciar y construir. Al terminar, pasas el turno.',
    ],
  },
  {
    id: 'build',
    title: 'Construir',
    body: [
      'Gasta recursos para crecer. Los caminos salen de tus poblados o de tus otros caminos.',
      'Regla de distancia: un poblado nuevo no puede tener ningún poblado o ciudad en las esquinas vecinas, y debe tocar uno de tus caminos.',
    ],
    extra: Costs,
  },
  {
    id: 'city',
    title: 'Ciudades: el doble',
    body: [
      'Con 2 trigo y 3 piedra mejoras un poblado a ciudad, en la misma esquina.',
      'La ciudad cobra 2 recursos en vez de 1 y vale 2 PV.',
    ],
  },
  {
    id: 'trade',
    title: 'Comerciar',
    body: [
      'En tu turno puedes ofrecer cartas a los demás. Pueden aceptar, rechazar o mandarte una contraoferta.',
      'También puedes cambiar con el banco: 4 cartas iguales por 1 de la que quieras.',
      'Con un poblado o ciudad en un puerto cambias mejor: 3 : 1 o 2 : 1 con su recurso.',
    ],
    extra: Trades,
  },
  {
    id: 'robber',
    title: 'El 7 y el ladrón',
    body: [
      'Si sale 7 nadie cobra, y quien tenga más de 7 cartas descarta la mitad.',
      'Quien tiró mueve al ladrón a otro terreno: ese terreno deja de producir mientras esté ahí.',
      'Además roba 1 carta al azar a alguien con poblado o ciudad en ese terreno. En el desierto no se roba nada.',
    ],
  },
  {
    id: 'pact',
    title: 'Pacto de paz',
    body: [
      'Regla opcional (la activa el anfitrión). Al mover al ladrón puedes ofrecer un pacto a un jugador.',
      'El trato: «dame hasta 2 cartas y no te ataco». Si acepta, te las da y el ladrón no puede ir a sus terrenos en esa jugada.',
      'Si lo rechaza o no responde a tiempo, el ladrón se mueve como siempre.',
    ],
  },
  {
    id: 'dev',
    title: 'Cartas de desarrollo',
    body: [
      'Cuestan 1 oveja, 1 trigo y 1 piedra. Puedes jugar 1 por turno, pero nunca la que compraste ese mismo turno.',
      'El Caballero es la única que se puede jugar antes de tirar los dados; las demás, después.',
    ],
    extra: DevList,
  },
  {
    id: 'awards',
    title: 'Camino más largo y Gran ejército',
    body: [
      'Quien tenga el camino seguido más largo (5 tramos o más) se lleva el Camino más largo: +2 PV.',
      'Quien haya jugado más Caballeros (3 o más) se lleva el Gran ejército: +2 PV.',
      'Ojo: si alguien te supera, se queda con la carta y sus puntos.',
    ],
  },
  {
    id: 'win',
    title: 'Ganar, y unos consejos',
    body: ['Si en tu turno llegas a la meta de puntos, ganas al instante. ¡A jugar!'],
    extra: Tips,
  },
];
