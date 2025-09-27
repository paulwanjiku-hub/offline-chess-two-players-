export enum PieceType {
  PAWN = 'pawn',
  ROOK = 'rook',
  KNIGHT = 'knight',
  BISHOP = 'bishop',
  QUEEN = 'queen',
  KING = 'king',
}

export enum PlayerColor {
  WHITE = 'white',
  BLACK = 'black',
}

export interface Piece {
  type: PieceType;
  color: PlayerColor;
}

export interface Position {
  row: number;
  col: number;
}

export type Board = (Piece | null)[][];

export enum GameState {
    PLAYING = 'Playing',
    CHECK = 'Check',
    CHECKMATE = 'Checkmate',
    STALEMATE = 'Stalemate',
    DRAW = 'Draw',
}
