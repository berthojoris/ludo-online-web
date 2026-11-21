<?php

namespace App\Services;

class ComputerStrategy
{
    private function __construct(
        private int $player,
        private array $spec,
        private array $starts,
    ) {}

    /** @param array<int, int> $moves Token indexes and destinations for the committed roll. */
    public static function chooseMove(array $state, int $player, array $moves): ?int
    {
        if (count($moves) < 2) {
            return array_key_first($moves);
        }

        $colors = $state['colors'] ?? ['blue', 'green'];
        $spec = MatchRules::spec($colors, isset($state['arms']) ? (int) $state['arms'] : null);
        $starts = array_map(fn (string $color) => $spec['starts'][$color] ?? null, $colors);
        $strategy = new self($player, $spec, $starts);
        $bestToken = null;
        $bestScore = -INF;

        foreach ($moves as $token => $target) {
            [$tokens, $gain, $captured, $finished] = $strategy->evaluateMove($state['tokens'], $token, $target);
            $score = $gain;
            if (! $finished) {
                $extraTurn = $state['dice'] === 6 || $captured || $target === $spec['finish_position'];
                $score += $extraTurn
                    ? $strategy->expectedExtraTurn(array_replace($state, ['tokens' => $tokens]))
                    : -$strategy->captureRisk($tokens);
            }

            if ($score > $bestScore) {
                $bestToken = $token;
                $bestScore = $score;
            }
        }

        return $bestToken;
    }

    private function evaluateMove(array $tokens, int $token, int $target): array
    {
        $source = $tokens[$this->player][$token];
        [$tokens, $captured] = MatchRules::moveTokens($tokens, $this->player, $token, $target, $this->starts, $this->spec);

        $gain = $this->positionValue($target) - $this->positionValue($source);
        foreach ($captured as $position) {
            $gain += 12 + 0.65 * $position;
        }

        $finish = $this->spec['finish_position'];
        $finished = $target === $finish
            && count(array_filter($tokens[$this->player], fn (int $position) => $position === $finish)) === count($tokens[$this->player]);

        return [$tokens, $gain + ($finished ? 250 : 0), $captured !== [], $finished];
    }

    private function positionValue(int $position): float
    {
        if ($position < 0) {
            return 0;
        }

        $value = 14 + 0.7 * $position;
        if ($position === $this->spec['finish_position']) {
            return $value + 42;
        }

        $cell = MatchRules::trackIndex($position, $this->starts[$this->player], $this->spec);

        return $value + ($cell === null ? 14 : (in_array($cell, $this->spec['safe'], true) ? 4 : 0));
    }

    private function captureRisk(array $tokens): float
    {
        $risk = 0;
        $trackLength = $this->spec['track_length'];
        $lastTrackPosition = $this->spec['last_track_position'];

        foreach ($tokens[$this->player] as $position) {
            $cell = MatchRules::trackIndex($position, $this->starts[$this->player], $this->spec);
            if ($cell === null || in_array($cell, $this->spec['safe'], true)) {
                continue;
            }

            $survival = 1.0;
            foreach ($this->starts as $opponent => $start) {
                if ($opponent === $this->player || $start === null) {
                    continue;
                }

                $destination = ($cell - $start + $trackLength) % $trackLength;
                if ($destination > $lastTrackPosition) {
                    continue;
                }

                $captureFaces = [];
                foreach ($tokens[$opponent] as $opponentPosition) {
                    $distance = $destination - $opponentPosition;
                    if ($opponentPosition >= 0 && $distance >= 1 && $distance <= 6) {
                        $captureFaces[$distance] = true;
                    }
                }
                $survival *= 1 - count($captureFaces) / 6;
            }

            $risk += (1 - $survival) * ($this->positionValue($position) + 12);
        }

        return $risk;
    }

    private function expectedExtraTurn(array $state): float
    {
        $expected = 0;
        $riskIfStuck = $this->captureRisk($state['tokens']);

        // Weigh all six possible outcomes equally without drawing another roll.
        foreach (range(1, 6) as $face) {
            $moves = MatchRules::moves($state, $this->player, $face);
            $bestScore = -INF;
            foreach ($moves as $token => $target) {
                [$tokens, $gain, , $finished] = $this->evaluateMove($state['tokens'], $token, $target);
                $bestScore = max($bestScore, 0.8 * $gain - ($finished ? 0 : $this->captureRisk($tokens)));
            }
            $expected += $moves ? $bestScore : -$riskIfStuck;
        }

        return $expected / 6;
    }
}
