<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\CharacterKillAnimationGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class CharacterKillAnimationController extends Controller
{
    public function __construct(
        private readonly CharacterKillAnimationGenerator $generator,
    ) {}

    /**
     * List all 7 characters with their kill-animation prompts and generated animated WebP status.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'model' => config('services.openrouter.image_model'),
            'configured' => filled(config('services.openrouter.api_key')),
            'format' => 'webp',
            'characters' => $this->generator->catalog(),
        ]);
    }

    /**
     * Generate animated WebP kill animations for all 7 characters (or a requested subset) via OpenRouter.
     */
    public function generateAll(Request $request): JsonResponse
    {
        set_time_limit(0);

        $validated = $request->validate([
            'characters' => ['nullable', 'array', 'min:1', 'max:7'],
            'characters.*' => ['required', 'string', Rule::in(Room::ALL_CHARACTERS)],
        ]);

        $summary = $this->generator->generateBatch(
            $validated['characters'] ?? null,
        );

        $status = $summary['failed_count'] > 0 && $summary['generated_count'] === 0
            ? 502
            : ($summary['failed_count'] > 0 ? 207 : 200);

        return response()->json($summary, $status);
    }

    /**
     * Generate or regenerate the animated WebP kill animation for a single character via OpenRouter.
     */
    public function generateOne(Request $request, string $character): JsonResponse
    {
        if (! in_array($character, Room::ALL_CHARACTERS, true)) {
            return response()->json([
                'message' => "Unknown character '{$character}'.",
                'allowed_characters' => Room::ALL_CHARACTERS,
            ], 404);
        }

        set_time_limit(240);

        $validated = $request->validate([
            'prompt' => ['nullable', 'string', 'min:10', 'max:4000'],
        ]);

        try {
            $result = $this->generator->generateForCharacter(
                $character,
                $validated['prompt'] ?? null,
            );

            return response()->json($result);
        } catch (RuntimeException $exception) {
            return response()->json([
                'character' => $character,
                'message' => $exception->getMessage(),
            ], 502);
        }
    }
}
