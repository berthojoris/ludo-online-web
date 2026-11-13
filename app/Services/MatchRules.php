<?php

namespace App\Services;

class MatchRules
{
    private const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

    public static function initial(int $startingPlayer): array
    {
        return ['tokens' => [[-1, -1, -1, -1], [-1, -1, -1, -1]], 'turn' => $startingPlayer, 'dice' => null, 'winner' => null];
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
                $absolute = self::absolute($player, $target);
                if ($absolute !== null && ! in_array($absolute, self::SAFE, true)) {
                    foreach ($state['tokens'][1 - $player] as $opponent) {
                        if (self::absolute(1 - $player, $opponent) === $absolute) {
                            $rolls[] = $roll;

                            continue 3;
                        }
                    }
                }
            }
        }

        return $rolls;
    }

    public static function absolute(int $player, int $position): ?int
    {
        return $position < 0 || $position > 50 ? null : (($player === 0 ? 39 : 13) + $position) % 52;
    }
}
