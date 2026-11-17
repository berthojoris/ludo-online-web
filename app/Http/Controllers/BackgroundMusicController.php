<?php

namespace App\Http\Controllers;

use App\Services\BackgroundMusicGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class BackgroundMusicController extends Controller
{
    public function __construct(
        private readonly BackgroundMusicGenerator $generator,
    ) {}

    /**
     * Show the gameplay background music prompt and generated file status.
     */
    public function show(): JsonResponse
    {
        return response()->json($this->generator->status());
    }

    /**
     * Generate or regenerate the gameplay background music via OpenRouter.
     */
    public function generate(Request $request): JsonResponse
    {
        set_time_limit(360);

        $validated = $request->validate([
            'prompt' => ['nullable', 'string', 'min:10', 'max:2000'],
            'format' => ['nullable', 'string', Rule::in(BackgroundMusicGenerator::SUPPORTED_FORMATS)],
        ]);

        try {
            return response()->json($this->generator->generate(
                $validated['prompt'] ?? null,
                $validated['format'] ?? 'mp3',
            ));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }
}
