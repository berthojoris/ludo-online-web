<?php

namespace App\Http\Controllers;

use App\Services\SpinWheelSoundGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class SpinWheelSoundController extends Controller
{
    public function __construct(
        private readonly SpinWheelSoundGenerator $generator,
    ) {}

    /**
     * List every spin-wheel sound effect with its prompt and generated file status.
     */
    public function index(): JsonResponse
    {
        return response()->json($this->generator->status());
    }

    /**
     * Generate every spin-wheel sound effect (or a requested subset) via OpenRouter.
     */
    public function generateAll(Request $request): JsonResponse
    {
        set_time_limit(0);

        $validated = $request->validate([
            'tracks' => ['nullable', 'array', 'min:1', 'max:4'],
            'tracks.*' => ['required', 'string', 'distinct', Rule::in(array_keys($this->generator->definitions()))],
            'format' => ['nullable', 'string', Rule::in(SpinWheelSoundGenerator::SUPPORTED_FORMATS)],
        ]);

        $summary = $this->generator->generateBatch(
            $validated['tracks'] ?? null,
            $validated['format'] ?? 'mp3',
        );

        $status = $summary['failed_count'] > 0 && $summary['generated_count'] === 0
            ? 502
            : ($summary['failed_count'] > 0 ? 207 : 200);

        return response()->json($summary, $status);
    }

    /**
     * Generate or regenerate one spin-wheel sound effect via OpenRouter.
     */
    public function generateOne(Request $request, string $track): JsonResponse
    {
        $definitions = $this->generator->definitions();

        if (! isset($definitions[$track])) {
            return response()->json([
                'message' => "Unknown spin-wheel track '{$track}'.",
                'allowed_tracks' => array_keys($definitions),
            ], 404);
        }

        set_time_limit(120);

        $validated = $request->validate([
            'prompt' => ['nullable', 'string', 'min:10', 'max:2000'],
            'format' => ['nullable', 'string', Rule::in(SpinWheelSoundGenerator::SUPPORTED_FORMATS)],
        ]);

        try {
            return response()->json($this->generator->generate(
                $track,
                $validated['prompt'] ?? null,
                $validated['format'] ?? 'mp3',
            ));
        } catch (RuntimeException $exception) {
            return response()->json([
                'track' => $track,
                'message' => $exception->getMessage(),
            ], 502);
        }
    }
}
