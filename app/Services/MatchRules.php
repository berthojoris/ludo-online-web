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
        if ($arms !== null && $arms >= 5 && $arms <= 7) {
            return $arms;
        }

        if ($arms === 4) {
            return 4;
        }

        $maxIndex = 0;
        foreach ($colors as $color) {
            $idx = array_search($color, Room::ALL_COLORS, true);
            if ($idx !== false && $idx > $maxIndex) {
                $maxIndex = $idx;
            }
        }

        $needed = max(count($colors), $maxIndex + 1);

        return $needed >= 5 ? min(7, $needed) : 4;
    }

    /**
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

        if ($resolvedArms <= 4) {
            return [
                'arms' => 4,
                'sector_length' => 13,
                'track_length' => 52,
                'last_track_position' => 50,
                'finish_position' => 56,
                'safe' => self::CLASSIC_SAFE,
                'starts' => self::CLASSIC_STARTS,
            ];
        }

        $sectorLength = 11;
        $trackLength = $resolvedArms * $sectorLength;
        $safe = [];
        $starts = [];

        for ($k = 0; $k < $resolvedArms; $k++) {
            $color = Room::ALL_COLORS[$k] ?? null;
            if ($color !== null) {
                $starts[$color] = $k * $sectorLength;
            }
            $safe[] = $k * $sectorLength;
            $safe[] = $k * $sectorLength + 6;
        }

        return [
            'arms' => $resolvedArms,
            'sector_length' => $sectorLength,
            'track_length' => $trackLength,
            'last_track_position' => $trackLength - 2,
            'finish_position' => $trackLength + 3,
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
            'had_six' => array_fill(0, $count, false),
            'total_moves' => 0,
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
     * Force a 6 on the player's 4th opening roll if their first 3 rolls produced no 6.
     */
    public static function shouldForceOpeningSix(array $state, int $player): bool
    {
        $rolls = (int) ($state['stats'][$player]['rolls'] ?? 0);
        $hasTokenOut = count(array_filter($state['tokens'][$player] ?? [], fn ($position) => $position !== -1)) > 0;
        $hadSix = (bool) ($state['had_six'][$player] ?? $hasTokenOut);

        return $rolls === 3 && ! $hadSix && ! $hasTokenOut;
    }

    public static function rollDice(array $state, int $player, bool $hostAdvantage = false): int
    {
        if (self::shouldForceOpeningSix($state, $player)) {
            return 6;
        }

        $value = random_int(1, 6);

        if ($hostAdvantage) {
            $preferred = self::captureRolls($state, $player);
            if (! $preferred && count(array_filter($state['tokens'][$player] ?? [], fn ($position) => $position !== -1)) === 0) {
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

    public static function absolute(int $player, int $position, array $colors = ['blue', 'green'], ?int $arms = null): ?int
    {
        $spec = self::spec($colors, $arms);

        if ($position < 0 || $position > $spec['last_track_position']) {
            return null;
        }

        $color = $colors[$player] ?? null;
        if ($color === null || ! isset($spec['starts'][$color])) {
            return null;
        }

        return ($spec['starts'][$color] + $position) % $spec['track_length'];
    }
}
