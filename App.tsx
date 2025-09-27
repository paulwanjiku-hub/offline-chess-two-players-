import React, { useReducer, useMemo } from 'react';
import { Board, Piece, PieceType, PlayerColor, Position, GameState } from './types';
import { INITIAL_BOARD, PIECE_SVGS } from './constants';
import { getLegalMoves, isKingInCheck, hasAnyLegalMoves, findKing, CastlingRights } from './services/chessLogic';

// --- Components ---

const CapturedPieces: React.FC<{ pieces: Piece[] }> = ({ pieces }) => (
  <div className="flex flex-wrap gap-1 h-12 items-center min-h-[48px]">
    {pieces.map((p, i) => (
      <div key={i} className="w-6 h-6">
        {PIECE_SVGS[p.color][p.type]}
      </div>
    ))}
  </div>
);

const GameStatus: React.FC<{ gameState: GameState; currentPlayer: PlayerColor; winner?: PlayerColor }> = ({ gameState, currentPlayer, winner }) => {
    const baseClasses = "text-2xl font-bold text-center p-2 rounded-lg transition-all";
    let message: string;
    let messageColor: string = "text-yellow-300";

    switch (gameState) {
        case GameState.PLAYING:
            message = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
            messageColor = currentPlayer === PlayerColor.WHITE ? 'text-white' : 'text-slate-400';
            break;
        case GameState.CHECK:
            message = `Check! ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
            messageColor = "text-red-400 animate-pulse";
            break;
        case GameState.CHECKMATE:
            message = `Checkmate! ${winner?.charAt(0).toUpperCase() + winner!.slice(1)} wins!`;
            messageColor = "text-green-400";
            break;
        case GameState.STALEMATE:
            message = "Stalemate! It's a draw.";
            messageColor = "text-blue-400";
            break;
        default:
            message = "Game Over";
    }

    return (
        <div className={`${baseClasses} ${messageColor}`}>
            {message}
        </div>
    );
};

const PromotionModal: React.FC<{ color: PlayerColor; onPromote: (pieceType: PieceType) => void }> = ({ color, onPromote }) => {
    const promotionPieces: PieceType[] = [PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT];
    return (
        <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-slate-700 p-4 rounded-lg flex gap-4 shadow-2xl">
                {promotionPieces.map(pieceType => (
                    <button key={pieceType} onClick={() => onPromote(pieceType)} className="w-16 h-16 hover:bg-slate-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {PIECE_SVGS[color][pieceType]}
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- State Management ---

interface AppState {
    board: Board;
    currentPlayer: PlayerColor;
    selectedSquare: Position | null;
    gameState: GameState;
    winner?: PlayerColor;
    capturedPieces: { [key in PlayerColor]: Piece[] };
    castlingRights: CastlingRights;
    enPassantTarget: Position | null;
    promotionSquare: Position | null;
    lastMove: { from: Position; to: Position } | null;
    kingInCheckPos: Position | null;
}

type Action =
    | { type: 'SQUARE_CLICK'; payload: Position }
    | { type: 'PROMOTE'; payload: PieceType }
    | { type: 'RESET_GAME' };

const INITIAL_STATE: AppState = {
    board: JSON.parse(JSON.stringify(INITIAL_BOARD)),
    currentPlayer: PlayerColor.WHITE,
    selectedSquare: null,
    gameState: GameState.PLAYING,
    winner: undefined,
    capturedPieces: { [PlayerColor.WHITE]: [], [PlayerColor.BLACK]: [] },
    castlingRights: { w: { k: true, q: true }, b: { k: true, q: true } },
    enPassantTarget: null,
    promotionSquare: null,
    lastMove: null,
    kingInCheckPos: null,
};

function gameReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'RESET_GAME':
            return JSON.parse(JSON.stringify(INITIAL_STATE));

        case 'PROMOTE': {
            if (!state.promotionSquare || !state.selectedSquare) return state;
            const { from, to } = { from: state.selectedSquare, to: state.promotionSquare };
            return performMove(state, from, to, action.payload);
        }

        case 'SQUARE_CLICK': {
            const { row, col } = action.payload;
            if (state.gameState === GameState.CHECKMATE || state.gameState === GameState.STALEMATE || state.promotionSquare) {
                return state;
            }

            if (state.selectedSquare) {
                const piece = state.board[state.selectedSquare.row][state.selectedSquare.col];
                if (!piece) return { ...state, selectedSquare: null };

                const legalMoves = getLegalMoves(piece, state.selectedSquare, state.board, state.enPassantTarget, state.castlingRights);
                const isMoveValid = legalMoves.some(m => m.row === row && m.col === col);

                if (isMoveValid) {
                    if (piece.type === PieceType.PAWN && (row === 0 || row === 7)) {
                        return { ...state, promotionSquare: { row, col } };
                    }
                    return performMove(state, state.selectedSquare, { row, col });
                } else {
                    const pieceAtClick = state.board[row][col];
                    if (pieceAtClick && pieceAtClick.color === state.currentPlayer) {
                        return { ...state, selectedSquare: { row, col } };
                    }
                    return { ...state, selectedSquare: null };
                }
            } else {
                const piece = state.board[row][col];
                if (piece && piece.color === state.currentPlayer) {
                    return { ...state, selectedSquare: { row, col } };
                }
            }
            return state;
        }

        default:
            return state;
    }
}

function performMove(state: AppState, from: Position, to: Position, promotionPieceType?: PieceType): AppState {
    const newBoard = state.board.map(r => [...r]);
    const pieceToMove = JSON.parse(JSON.stringify(newBoard[from.row][from.col]!));
    const capturedPiece = newBoard[to.row][to.col];

    // Handle en passant capture
    if (pieceToMove.type === PieceType.PAWN && state.enPassantTarget && to.row === state.enPassantTarget.row && to.col === state.enPassantTarget.col) {
        const capturedPawnRow = state.currentPlayer === PlayerColor.WHITE ? to.row + 1 : to.row - 1;
        newBoard[capturedPawnRow][to.col] = null;
    }

    if (promotionPieceType) {
        pieceToMove.type = promotionPieceType;
    }

    newBoard[to.row][to.col] = pieceToMove;
    newBoard[from.row][from.col] = null;

    // Handle castling rook move
    if (pieceToMove.type === PieceType.KING && Math.abs(to.col - from.col) === 2) {
        const backRank = from.row;
        if (to.col === 6) { // Kingside
            newBoard[backRank][5] = newBoard[backRank][7];
            newBoard[backRank][7] = null;
        } else { // Queenside
            newBoard[backRank][3] = newBoard[backRank][0];
            newBoard[backRank][0] = null;
        }
    }

    const newCaptured = { ...state.capturedPieces };
    if (capturedPiece) {
        newCaptured[capturedPiece.color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE].push(capturedPiece);
    }

    // Update castling rights
    const newCastlingRights = JSON.parse(JSON.stringify(state.castlingRights));
    if (pieceToMove.type === PieceType.KING) {
        if (pieceToMove.color === PlayerColor.WHITE) {
            newCastlingRights.w.k = false; newCastlingRights.w.q = false;
        } else {
            newCastlingRights.b.k = false; newCastlingRights.b.q = false;
        }
    }
    if (pieceToMove.type === PieceType.ROOK) {
        if (from.row === 7 && from.col === 7) newCastlingRights.w.k = false;
        if (from.row === 7 && from.col === 0) newCastlingRights.w.q = false;
        if (from.row === 0 && from.col === 7) newCastlingRights.b.k = false;
        if (from.row === 0 && from.col === 0) newCastlingRights.b.q = false;
    }

    let newEnPassantTarget: Position | null = null;
    if (pieceToMove.type === PieceType.PAWN && Math.abs(to.row - from.row) === 2) {
        newEnPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    }

    const nextPlayer = state.currentPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
    const kingInCheck = isKingInCheck(newBoard, nextPlayer);
    const anyLegalMoves = hasAnyLegalMoves(newBoard, nextPlayer, newEnPassantTarget, newCastlingRights);

    let newGameState = GameState.PLAYING;
    let winner: PlayerColor | undefined = undefined;
    if (kingInCheck && !anyLegalMoves) {
        newGameState = GameState.CHECKMATE;
        winner = state.currentPlayer;
    } else if (!kingInCheck && !anyLegalMoves) {
        newGameState = GameState.STALEMATE;
    } else if (kingInCheck) {
        newGameState = GameState.CHECK;
    }

    return {
        ...state,
        board: newBoard,
        currentPlayer: nextPlayer,
        selectedSquare: null,
        capturedPieces: newCaptured,
        castlingRights: newCastlingRights,
        enPassantTarget: newEnPassantTarget,
        lastMove: { from, to },
        promotionSquare: null,
        gameState: newGameState,
        winner,
        kingInCheckPos: kingInCheck ? findKing(newBoard, nextPlayer) : null,
    };
}


const App: React.FC = () => {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
    const { board, selectedSquare, enPassantTarget, castlingRights, lastMove, kingInCheckPos, capturedPieces, gameState, currentPlayer, winner, promotionSquare } = state;
    
    const validMoves = useMemo(() => {
        if (selectedSquare) {
            const piece = board[selectedSquare.row][selectedSquare.col];
            if (piece) {
                return getLegalMoves(piece, selectedSquare, board, enPassantTarget, castlingRights);
            }
        }
        return [];
    }, [selectedSquare, board, enPassantTarget, castlingRights]);

    const getSquareAriaLabel = (rowIndex: number, colIndex: number, piece: Piece | null) => {
        const file = String.fromCharCode('a'.charCodeAt(0) + colIndex);
        const rank = 8 - rowIndex;
        let label = `${file}${rank}`;
        if (piece) {
            label += `, ${piece.color} ${piece.type}`;
        }
        return label;
    }

    return (
        <main className="min-h-screen bg-slate-800 flex flex-col items-center justify-start lg:justify-center p-2 sm:p-4 font-sans text-white relative">
            {promotionSquare && selectedSquare && <PromotionModal color={board[selectedSquare.row][selectedSquare.col]!.color} onPromote={(pt) => dispatch({ type: 'PROMOTE', payload: pt })} />}
            
            <header className="mb-4 text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-200">React Offline Chess</h1>
            </header>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full max-w-7xl items-center lg:items-start">
                
                {/* Main Game Area */}
                <div className="flex flex-col gap-2 w-full max-w-[640px]">
                    <div className="bg-slate-700 p-2 rounded-lg">
                        <CapturedPieces pieces={capturedPieces[PlayerColor.WHITE]} />
                    </div>
                    
                    <div className="w-full aspect-square">
                        <div className="grid grid-cols-8 w-full h-full border-4 border-slate-600 rounded-md overflow-hidden shadow-2xl">
                            {board.map((rowArr, rowIndex) =>
                                rowArr.map((piece, colIndex) => {
                                    const isLightSquare = (rowIndex + colIndex) % 2 !== 0;
                                    const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                                    const isMoveTarget = validMoves.some(m => m.row === rowIndex && m.col === colIndex);
                                    const isLastMove = (lastMove?.from.row === rowIndex && lastMove?.from.col === colIndex) || (lastMove?.to.row === rowIndex && lastMove?.to.col === colIndex);
                                    const isKingInCheckSquare = kingInCheckPos?.row === rowIndex && kingInCheckPos?.col === colIndex;

                                    return (
                                        <button
                                            key={`${rowIndex}-${colIndex}`}
                                            aria-label={getSquareAriaLabel(rowIndex, colIndex, piece)}
                                            className={`
                                                w-full h-full flex items-center justify-center relative group
                                                ${isLightSquare ? 'bg-green-200' : 'bg-green-700'}
                                                transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10
                                            `}
                                            onClick={() => dispatch({ type: 'SQUARE_CLICK', payload: { row: rowIndex, col: colIndex }})}
                                        >
                                            {isLastMove && <div className="absolute inset-0 bg-yellow-400 opacity-40"></div>}
                                            {isKingInCheckSquare && <div className="absolute inset-0 bg-red-500 opacity-70 rounded-full animate-pulse"></div>}

                                            {piece && (
                                                <div className={`w-full h-full p-1 transition-transform duration-100 ${isSelected ? 'scale-110 -translate-y-1' : 'group-hover:scale-105'}`}>
                                                    {PIECE_SVGS[piece.color][piece.type]}
                                                </div>
                                            )}
                                            {isSelected && <div className="absolute inset-0 bg-yellow-400 opacity-50 ring-2 ring-yellow-600 z-20"></div>}
                                            {isMoveTarget && (
                                                <div className="absolute w-1/3 h-1/3 rounded-full bg-slate-800 bg-opacity-50"></div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-700 p-2 rounded-lg">
                         <CapturedPieces pieces={capturedPieces[PlayerColor.BLACK]} />
                    </div>
                </div>

                {/* Sidebar / Controls Area */}
                <div className="w-full lg:w-64 flex flex-col gap-4 items-center mt-2 lg:mt-0">
                    <GameStatus gameState={gameState} currentPlayer={currentPlayer} winner={winner} />
                    <button
                        onClick={() => dispatch({ type: 'RESET_GAME' })}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 shadow-lg"
                    >
                        New Game
                    </button>
                </div>
            </div>
        </main>
    );
};

export default App;
