import { Board, Piece, PieceType, PlayerColor, Position } from '../types';

export interface CastlingRights {
  w: { k: boolean; q: boolean };
  b: { k: boolean; q: boolean };
}

const isPositionOnBoard = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
};

const getPieceAt = (board: Board, pos: Position): Piece | null => {
    return board[pos.row][pos.col];
}

const getPawnMoves = (piece: Piece, pos: Position, board: Board, enPassantTarget: Position | null): Position[] => {
    const moves: Position[] = [];
    const direction = piece.color === PlayerColor.WHITE ? -1 : 1;
    const startRow = piece.color === PlayerColor.WHITE ? 6 : 1;

    // 1 square forward
    const oneStep: Position = { row: pos.row + direction, col: pos.col };
    if (isPositionOnBoard(oneStep) && !getPieceAt(board, oneStep)) {
        moves.push(oneStep);
        // 2 squares forward from start
        if (pos.row === startRow) {
            const twoSteps: Position = { row: pos.row + 2 * direction, col: pos.col };
            if (isPositionOnBoard(twoSteps) && !getPieceAt(board, twoSteps)) {
                moves.push(twoSteps);
            }
        }
    }

    // Captures
    const captureOffsets = [-1, 1];
    for (const offset of captureOffsets) {
        const capturePos: Position = { row: pos.row + direction, col: pos.col + offset };
        if (isPositionOnBoard(capturePos)) {
            const targetPiece = getPieceAt(board, capturePos);
            if (targetPiece && targetPiece.color !== piece.color) {
                moves.push(capturePos);
            }
            // En passant
            if (enPassantTarget && capturePos.row === enPassantTarget.row && capturePos.col === enPassantTarget.col) {
                moves.push(capturePos);
            }
        }
    }

    return moves;
};

const getSlidingMoves = (piece: Piece, pos: Position, board: Board, directions: Position[]): Position[] => {
    const moves: Position[] = [];
    for (const dir of directions) {
        let currentPos = { row: pos.row + dir.row, col: pos.col + dir.col };
        while(isPositionOnBoard(currentPos)) {
            const targetPiece = getPieceAt(board, currentPos);
            if (!targetPiece) {
                moves.push(currentPos);
            } else {
                if (targetPiece.color !== piece.color) {
                    moves.push(currentPos);
                }
                break;
            }
            currentPos = { row: currentPos.row + dir.row, col: currentPos.col + dir.col };
        }
    }
    return moves;
}

const getRookMoves = (piece: Piece, pos: Position, board: Board): Position[] => {
    const directions: Position[] = [{row: -1, col: 0}, {row: 1, col: 0}, {row: 0, col: -1}, {row: 0, col: 1}];
    return getSlidingMoves(piece, pos, board, directions);
};

const getBishopMoves = (piece: Piece, pos: Position, board: Board): Position[] => {
    const directions: Position[] = [{row: -1, col: -1}, {row: -1, col: 1}, {row: 1, col: -1}, {row: 1, col: 1}];
    return getSlidingMoves(piece, pos, board, directions);
};

const getQueenMoves = (piece: Piece, pos: Position, board: Board): Position[] => {
    return [...getRookMoves(piece, pos, board), ...getBishopMoves(piece, pos, board)];
};

const getKnightMoves = (piece: Piece, pos: Position, board: Board): Position[] => {
    const moves: Position[] = [];
    const offsets = [
        {row: -2, col: -1}, {row: -2, col: 1}, {row: -1, col: -2}, {row: -1, col: 2},
        {row: 1, col: -2}, {row: 1, col: 2}, {row: 2, col: -1}, {row: 2, col: 1}
    ];
    for (const offset of offsets) {
        const newPos = { row: pos.row + offset.row, col: pos.col + offset.col };
        if(isPositionOnBoard(newPos)) {
            const targetPiece = getPieceAt(board, newPos);
            if (!targetPiece || targetPiece.color !== piece.color) {
                moves.push(newPos);
            }
        }
    }
    return moves;
};

const getKingMoves = (piece: Piece, pos: Position, board: Board, castlingRights?: CastlingRights): Position[] => {
    const moves: Position[] = [];
    const offsets = [
        {row: -1, col: -1}, {row: -1, col: 0}, {row: -1, col: 1},
        {row: 0, col: -1},                      {row: 0, col: 1},
        {row: 1, col: -1}, {row: 1, col: 0}, {row: 1, col: 1}
    ];
    for (const offset of offsets) {
        const newPos = { row: pos.row + offset.row, col: pos.col + offset.col };
        if(isPositionOnBoard(newPos)) {
            const targetPiece = getPieceAt(board, newPos);
            if (!targetPiece || targetPiece.color !== piece.color) {
                moves.push(newPos);
            }
        }
    }
    
    // Castling - only if castlingRights are provided
    if (castlingRights) {
        const opponentColor = piece.color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
        const backRank = piece.color === PlayerColor.WHITE ? 7 : 0;
        const rights = piece.color === PlayerColor.WHITE ? castlingRights.w : castlingRights.b;

        if (pos.row === backRank && pos.col === 4 && !isSquareAttacked(pos, opponentColor, board)) {
            // Kingside
            if (rights.k && !board[backRank][5] && !board[backRank][6]) {
                if (!isSquareAttacked({row: backRank, col: 5}, opponentColor, board) && !isSquareAttacked({row: backRank, col: 6}, opponentColor, board)) {
                    moves.push({row: backRank, col: 6});
                }
            }
            // Queenside
            if (rights.q && !board[backRank][1] && !board[backRank][2] && !board[backRank][3]) {
                if (!isSquareAttacked({row: backRank, col: 2}, opponentColor, board) && !isSquareAttacked({row: backRank, col: 3}, opponentColor, board)) {
                    moves.push({row: backRank, col: 2});
                }
            }
        }
    }

    return moves;
};

export const getPseudoLegalMoves = (piece: Piece, pos: Position, board: Board, enPassantTarget: Position | null, castlingRights?: CastlingRights): Position[] => {
    switch (piece.type) {
        case PieceType.PAWN: return getPawnMoves(piece, pos, board, enPassantTarget);
        case PieceType.ROOK: return getRookMoves(piece, pos, board);
        case PieceType.KNIGHT: return getKnightMoves(piece, pos, board);
        case PieceType.BISHOP: return getBishopMoves(piece, pos, board);
        case PieceType.QUEEN: return getQueenMoves(piece, pos, board);
        case PieceType.KING: return getKingMoves(piece, pos, board, castlingRights);
        default: return [];
    }
};

export const isSquareAttacked = (pos: Position, attackerColor: PlayerColor, board: Board): boolean => {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === attackerColor) {
                 if (piece.type === PieceType.PAWN) {
                    const direction = piece.color === PlayerColor.WHITE ? -1 : 1;
                    if (pos.row === r + direction && (pos.col === c - 1 || pos.col === c + 1)) {
                        return true;
                    }
                } else {
                    // For other pieces, their attack pattern is the same as their move pattern.
                    // We don't pass castling rights because castling is not an attack.
                    const moves = getPseudoLegalMoves(piece, { row: r, col: c }, board, null);
                    if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

export const findKing = (board: Board, color: PlayerColor): Position | null => {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === PieceType.KING && piece.color === color) {
                return { row: r, col: c };
            }
        }
    }
    return null;
};

export const isKingInCheck = (board: Board, kingColor: PlayerColor): boolean => {
    const kingPos = findKing(board, kingColor);
    if (!kingPos) return false;

    const opponentColor = kingColor === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
    return isSquareAttacked(kingPos, opponentColor, board);
};

export const getLegalMoves = (piece: Piece, pos: Position, board: Board, enPassantTarget: Position | null, castlingRights: CastlingRights): Position[] => {
    const pseudoLegalMoves = getPseudoLegalMoves(piece, pos, board, enPassantTarget, castlingRights);
    const legalMoves: Position[] = [];

    for (const move of pseudoLegalMoves) {
        const newBoard = board.map(row => [...row]);
        newBoard[move.row][move.col] = piece;
        newBoard[pos.row][pos.col] = null;
        
        // Handle en passant capture for check testing
        if (piece.type === PieceType.PAWN && enPassantTarget && move.row === enPassantTarget.row && move.col === enPassantTarget.col) {
            const capturedPawnRow = piece.color === PlayerColor.WHITE ? move.row + 1 : move.row - 1;
            newBoard[capturedPawnRow][move.col] = null;
        }

        // Handle castling rook movement for check testing
        if (piece.type === PieceType.KING && Math.abs(move.col - pos.col) === 2) {
            const backRank = pos.row;
            if (move.col === 6) { // Kingside
                newBoard[backRank][5] = newBoard[backRank][7];
                newBoard[backRank][7] = null;
            } else { // Queenside
                newBoard[backRank][3] = newBoard[backRank][0];
                newBoard[backRank][0] = null;
            }
        }

        if (!isKingInCheck(newBoard, piece.color)) {
            legalMoves.push(move);
        }
    }
    return legalMoves;
};

export const hasAnyLegalMoves = (board: Board, color: PlayerColor, enPassantTarget: Position | null, castlingRights: CastlingRights): boolean => {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === color) {
                const legalMoves = getLegalMoves(piece, { row: r, col: c }, board, enPassantTarget, castlingRights);
                if (legalMoves.length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}
