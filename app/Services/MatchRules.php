<?php

namespace App\Services;

use App\Models\Room;

class MatchRules
{
    private const CLASSIC_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

    private const CLASSIC_STARTS = [
        'red' => 0,
        'green' => 13,
        'yellow' => 26,
        'blue' => 39,
    ];

    public static function resolveArms(array $colors, ?int $arms = null): int
    {
        if ($arms === 3 || ($arms !== null && $arms >= 5 && $arms <= 7)) {
            return $arms;
        }

        if ($arms === 4) {
            return 4;
        }

        return self::defaultArms(count($colors));
    }

    /**
     * Board arms for a new match: 3 players use the three-base board,
     * 2 and 4 players the classic cross, 5-7 players the radial star.
     */
    public static function defaultArms(int $playerCount): int
    {
        if ($playerCount === 3) {
            return 3;
        }

        return $playerCount >= 5 ? min(7, $playerCount) : 4;
    }

    /**
     * Track cells along one side of a radial arm; the three-base board uses classic-length arms.
     */
    private static function radialStepsPerArm(int $arms): int
    {
        return $arms === 3 ? 6 : 5;
    }

    /**
     * Map active player colors onto the board's physical arms/slots.
     *
     * @param  list<string>  $colors
     * @return list<string>
     */
    public static function resolveSlotColors(array $colors, int $arms): array
    {
        $template = array_slice(Room::ALL_COLORS, 0, $arms);
        $slots = array_fill(0, $arms, null);
        $unplaced = [];

        foreach ($colors as $color) {
            $idx = array_search($color, $template, true);
            if ($idx !== false && $slots[$idx] === null) {
                $slots[$idx] = $color;
            } elseif (! in_array($color, $unplaced, true)) {
                $unplaced[] = $color;
            }
        }

        foreach ($unplaced as $color) {
            $emptyIdx = array_search(null, $slots, true);
            if ($emptyIdx !== false) {
                $slots[$emptyIdx] = $color;
            }
        }

        for ($k = 0; $k < $arms; $k++) {
            if ($slots[$k] === null) {
                $slots[$k] = $template[$k];
            }
        }

        return $slots;
    }

    /**
     * Track geometry for the board the match is played on. Only the 4-arm
     * board uses the classic cross; the three-base board and the 5-7 arm
     * stars share the radial geometry, mirroring getBoardSpec() on the client.
     *
     * @return array{
     *     arms: int,
     *     sector_length: int,
     *     track_length: int,
     *     last_track_position: int,
     *     finish_position: int,
     *     safe: list<int>,
     *     starts: array<string, int>
     * }
     */
    public static function spec(array $colors, ?int $arms = null): array
    {
        $resolvedArms = self::resolveArms($colors, $arms);

        if ($resolvedArms === 4) {
            $slots = self::resolveSlotColors($colors, 4);
            $classicStartOffsets = [0, 13, 26, 39];
            $starts = [];
            for ($k = 0; $k < 4; $k++) {
                $starts[$slots[$k]] = $classicStartOffsets[$k];
            }

            return [
                'arms' => 4,
                'sector_length' => 13,
                'track_length' => 52,
                'last_track_position' => 50,
                'finish_position' => 56,
                'safe' => self::CLASSIC_SAFE,
                'starts' => $starts,
            ];
        }

        $stepsPerArm = self::radialStepsPerArm($resolvedArms);
        $sectorLength = 2 * $stepsPerArm + 1;
        $safeOffset = 2 * $stepsPerArm - 4;
        $trackLength = $resolvedArms * $sectorLength;
        $safe = [];
        $starts = [];
        $slots = self::resolveSlotColors($colors, $resolvedArms);

        for ($k = 0; $k < $resolvedArms; $k++) {
            $starts[$slots[$k]] = $k * $sectorLength;
            $safe[] = $k * $sectorLength;
            $safe[] = $k * $sectorLength + $safeOffset;
        }

        return [
            'arms' => $resolvedArms,
            'sector_length' => $sectorLength,
            'track_length' => $trackLength,
            'last_track_position' => $trackLength - 2,
            'finish_position' => $trackLength - 1 + ($stepsPerArm - 1),
            'safe' => $safe,
            'starts' => $starts,
        ];
    }

    /**
     * @return list<int>
     */
    public static function safeIndices(array $colors, ?int $arms = null): array
    {
        return self::spec($colors, $arms)['safe'];
    }

    public static function finishPosition(array $colors, ?int $arms = null): int
    {
        return self::spec($colors, $arms)['finish_position'];
    }

    public static function initial(int $startingPlayer, array $colors = ['blue', 'green'], ?int $arms = null): array
    {
        $count = count($colors);
        $resolvedArms = self::resolveArms($colors, $arms);

        return [
            'tokens' => array_fill(0, $count, [-1, -1, -1, -1]),
            'colors' => $colors,
            'arms' => $resolvedArms,
            'turn' => $startingPlayer,
            'dice' => null,
            'winner' => null,
            'winners' => [],
            'stats' => array_fill(0, $count, ['rolls' => 0, 'captures' => 0]),
            'base_roll_misses' => array_fill(0, $count, 0),
            'consecutive_timeouts' => array_fill(0, $count, 0),
            'forfeited' => [],
            'turn_timed_out' => false,
            'total_moves' => 0,
            'state_version' => 0,
            'last_roll' => null,
            'turn_started_at' => now()->getTimestampMs(),
        ];
    }

    public static function nextTurn(array $state, int $currentPlayer): int
    {
        $count = count($state['tokens']);
        $winners = $state['winners'] ?? [];

        for ($offset = 1; $offset <= $count; $offset++) {
            $candidate = ($currentPlayer + $offset) % $count;
            if (! in_array($candidate, $winners, true)) {
                return $candidate;
            }
        }

        return ($currentPlayer + 1) % $count;
    }

    /**
     * End the match once only one player has not finished, ranking that player last.
     */
    public static function finalizeWhenOnePlayerRemains(array $state): array
    {
        $count = count($state['tokens']);
        $winners = $state['winners'] ?? [];

        if ($count < 2 || count($winners) < $count - 1) {
            return $state;
        }

        for ($player = 0; $player < $count; $player++) {
            if (! in_array($player, $winners, true)) {
                $winners[] = $player;
            }
        }

        $state['winners'] = $winners;
        $state['winner'] = $winners[0];

        return $state;
    }

    private static function allTokensInBase(array $state, int $player): bool
    {
        $tokens = $state['tokens'][$player] ?? [];

        return $tokens !== [] && count(array_keys($tokens, -1, true)) === count($tokens);
    }

    private static function baseRollMisses(array $state, int $player): int
    {
        if (isset($state['base_roll_misses'][$player])) {
            return (int) $state['base_roll_misses'][$player];
        }

        // Older snapshots can recover the streak only if the player never rolled a six.
        return ($state['had_six'][$player] ?? false) ? 0 : (int) ($state['stats'][$player]['rolls'] ?? 0);
    }

    public static function recordRoll(array $state, int $player, int $value, bool $trackBaseMisses): array
    {
        if ($trackBaseMisses) {
            $state['base_roll_misses'][$player] = $value !== 6 && self::allTokensInBase($state, $player)
                ? self::baseRollMisses($state, $player) + 1
                : 0;
        }

        $state['stats'][$player]['rolls'] = ($state['stats'][$player]['rolls'] ?? 0) + 1;

        return $state;
    }

    public static function rollDice(array $state, int $player, bool $hostAdvantage = false): int
    {
        if (self::allTokensInBase($state, $player) && self::baseRollMisses($state, $player) >= 3) {
            return 6;
        }

        $value = random_int(1, 6);

        if ($hostAdvantage) {
            $preferred = self::captureRolls($state, $player);
            if (! $preferred && self::moves($state, $player, 6)) {
                $preferred = [6];
            }
            if ($preferred && random_int(1, 2) === 1) {
                $value = $preferred[array_rand($preferred)];
            } elseif ($preferred) {
                $other = array_values(array_diff(range(1, 6), $preferred));
                $value = $other ? $other[array_rand($other)] : $value;
            }
        }

        return $value;
    }

    public static function moves(array $state, int $player, int $roll): array
    {
        $colors = $state['colors'] ?? ['blue', 'green'];
        $arms = isset($state['arms']) ? (int) $state['arms'] : null;
        $finish = self::finishPosition($colors, $arms);

        $moves = [];
        foreach ($state['tokens'][$player] as $index => $position) {
            if ($position === -1 && $roll === 6) {
                $moves[$index] = 0;
            } elseif ($position >= 0 && $position + $roll <= $finish) {
                $moves[$index] = $position + $roll;
            }
        }

        return $moves;
    }

    public static function captureRolls(array $state, int $player): array
    {
        $colors = $state['colors'] ?? ['blue', 'green'];
        $arms = isset($state['arms']) ? (int) $state['arms'] : null;
        $safe = self::safeIndices($colors, $arms);

        $rolls = [];
        foreach (range(1, 6) as $roll) {
            foreach (self::moves($state, $player, $roll) as $target) {
                $absolute = self::absolute($player, $target, $colors, $arms);
                if ($absolute !== null && ! in_array($absolute, $safe, true)) {
                    foreach ($state['tokens'] as $opponentIndex => $tokens) {
                        if ($opponentIndex === $player) {
                            continue;
                        }
                        foreach ($tokens as $opponent) {
                            if (self::absolute($opponentIndex, $opponent, $colors, $arms) === $absolute) {
                                $rolls[] = $roll;

                                continue 4;
                            }
                        }
                    }
                }
            }
        }

        return $rolls;
    }

    /** @return array{0: array, 1: list<int>} Updated tokens and captured positions. */
    public static function moveTokens(array $tokens, int $player, int $token, int $target, array $starts, array $spec): array
    {
        $tokens[$player][$token] = $target;
        $captured = [];
        $absolute = self::trackIndex($target, $starts[$player], $spec);
        if ($absolute === null || in_array($absolute, $spec['safe'], true)) {
            return [$tokens, $captured];
        }

        foreach ($tokens as $opponent => $positions) {
            if ($opponent === $player) {
                continue;
            }
            foreach ($positions as $index => $position) {
                if (self::trackIndex($position, $starts[$opponent], $spec) === $absolute) {
                    $tokens[$opponent][$index] = -1;
                    $captured[] = $position;
                }
            }
        }

        return [$tokens, $captured];
    }

    public static function absolute(int $player, int $position, array $colors = ['blue', 'green'], ?int $arms = null): ?int
    {
        $spec = self::spec($colors, $arms);

        return self::trackIndex($position, $spec['starts'][$colors[$player] ?? ''] ?? null, $spec);
    }

    public static function trackIndex(int $position, ?int $start, array $spec): ?int
    {
        if ($start === null || $position < 0 || $position > $spec['last_track_position']) {
            return null;
        }

        return ($start + $position) % $spec['track_length'];
    }
}
