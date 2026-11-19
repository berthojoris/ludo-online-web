import type { CharacterId, PlayerColor } from '@/lib/ludo';

export type PlayerId = PlayerColor;
export type Phase = 'idle' | 'rolling' | 'choosing' | 'gameover';
export type Screen = 'setup' | 'game';

export type LegalMove = {
    tokenIndex: number;
    target: number;
};

export type LogEntry = {
    id: number;
    text: string;
    color?: PlayerId;
};

export type SetupNames = Record<PlayerId, string>;
export type SetupCharacters = Record<PlayerId, CharacterId>;

export type LastRoll = {
    player: number;
    value: number;
    state_version: number;
};

export type MatchSnapshot = {
    tokens: number[][];
    colors?: PlayerId[];
    arms?: number;
    turn: number;
    dice: number | null;
    winner: number | null;
    winners?: number[];
    stats?: { rolls: number; captures: number }[];
    had_six?: boolean[];
    total_moves?: number;
    state_version?: number;
    last_roll?: LastRoll | null;
    turn_started_at?: number | null;
    afk_auto_move?: boolean;
};

export type MatchActionData = {
    action_id?: string;
    type?: 'roll' | 'move' | 'end';
    player_id?: number;
    value?: number;
    token_index?: number;
    state_version?: number;
    server_now?: number;
    match_state?: MatchSnapshot;
};

export type MatchCommandResponse = {
    ok?: boolean;
    action?: MatchActionData;
};

export type GameState = {
    version: number;
    order: PlayerId[];
    arms: number;
    tokens: Record<PlayerId, number[]>;
    turn: PlayerId;
    human: PlayerId;
    names: SetupNames;
    characters: SetupCharacters;
    phase: Phase;
    dice: number | null;
    legalMoves: LegalMove[];
    winner: PlayerId | null;
    winners: PlayerId[];
    message: string;
    log: LogEntry[];
    logId: number;
    rolls: Record<PlayerId, number>;
    hadSix: Record<PlayerId, boolean>;
    captures: Record<PlayerId, number>;
    totalMoves: number;
    startedAt: number | null;
    finishedAt: number | null;
};

export type Action =
    | {
          type: 'RESTORE';
          match: MatchSnapshot & {
              started_at?: string | null;
          };
          animateRoll?: boolean;
      }
    | {
          type: 'START';
          human: PlayerId;
          names: SetupNames;
          characters?: Partial<SetupCharacters>;
          order?: PlayerId[];
          arms?: number;
          now: number;
          turn?: PlayerId;
      }
    | { type: 'ROLL_START'; value: number; version?: number }
    | { type: 'ROLL_RESULT'; value: number }
    | { type: 'MOVE'; tokenIndex: number; now: number; version?: number }
    | { type: 'RESET'; now: number; turn?: PlayerId };
