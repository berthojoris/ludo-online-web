<?php

namespace App\Services;

class MatchRules
{
    private const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

    public static function initial(int $startingPlayer, array $colors = ['blue', 'green']): array
    {
        return ['tokens' => array_fill(0, count($colors), [-1, -1, -1, -1]), 'colors' => $colors, 'turn' => $startingPlayer, 'dice' => null, 'winner' => null];
    }

    public static function moves(array $state, int $player, int $roll): array
    {
        $moves = [];
        foreach ($state['tokens'][$player] as $index => $position) {
            if ($position === -1 && $roll === 6) {
                $moves[$index] = 0;
            } elseif ($position >= 0 && $position + $roll <= 56) {
                $moves[$index] = $position + $roll;
            }
        }

        return $moves;
    }

    public static function captureRolls(array $state, int $player): array
    {
        $rolls = [];
        foreach (range(1, 6) as $roll) {
            foreach (self::moves($state, $player, $roll) as $target) {
                $absolute = self::absolute($player, $target, $state['colors'] ?? ['blue', 'green']);
                if ($absolute !== null && ! in_array($absolute, self::SAFE, true)) {
                    foreach ($state['tokens'] as $opponentIndex => $tokens) {
                        if ($opponentIndex === $player) {
                            continue;
                        }
                        foreach ($tokens as $opponent) {
                            if (self::absolute($opponentIndex, $opponent, $state['colors'] ?? ['blue', 'green']) === $absolute) {
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

    public static function absolute(int $player, int $position, array $colors = ['blue', 'green']): ?int
    {
        $starts = ['red' => 0, 'green' => 13, 'yellow' => 26, 'blue' => 39];

        return $position < 0 || $position > 50 ? null : ($starts[$colors[$player]] + $position) % 52;
    }
}
