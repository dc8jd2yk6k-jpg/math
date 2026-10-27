// All set pieces, in story order.
import { Shannon } from './shannon.js';
import { Chess } from './chess.js';
import { Go } from './go.js';
import { LeanCard } from './imo24.js';
import { Geometry } from './imo25.js';
import { Erdos } from './erdos.js';
import { Jacobian } from './jacobian.js';
import { Percolation } from './percolation.js';
import { Navier } from './navier.js';
import { Papers } from './papers.js';
import { YangMills } from './yangmills.js';
import { ETH } from './eth.js';

export function buildPieces(film) {
  return [
    new Shannon(), new Chess(), new Go(), new LeanCard(), new Geometry(), new Erdos(), new Jacobian(),
    new Percolation(), new Navier(), new Papers(), new YangMills(), new ETH(film),
  ];
}
