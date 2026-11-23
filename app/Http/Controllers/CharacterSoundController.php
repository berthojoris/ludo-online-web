<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\CharacterSoundGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class CharacterSoundController extends Controller
{
    public function __construct(
        private readonly CharacterSoundGenerator $generator,
    ) {}

    /**
     * List all 7 characters with their sound prompts and generated file status.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'model' => config('services.openrouter.audio_model'),
            'configured' => filled(config('services.openrouter.api_key')),
            'characters' => $this->generator->catalog(),
        ]);
    }

    /**
     * Generate sound effects for all 7 characters (or a requested subset) via OpenRouter.
     */
    public function generateAll(Request $request): JsonResponse
    {
        set_time_limit(0);

        $validated = $request->validate([
            'characters' => ['nullable', 'array', 'min:1', 'max:7'],
            'characters.*' => ['required', 'string', 'distinct', Rule::in(Room::ALL_CHARACTERS)],
            'format' => ['nullable', 'string', Rule::in(CharacterSoundGenerator::SUPPORTED_FORMATS)],
        ]);

        $summary = $this->generator->generateBatch(
            $validated['characters'] ?? null,
            $validated['format'] ?? 'mp3',
        );

        $status = $summary['failed_count'] > 0 && $summary['generated_count'] === 0
            ? 502
            : ($summary['failed_count'] > 0 ? 207 : 200);

        return response()->json($summary, $status);
    }

    /**
     * Generate or regenerate the sound effect for a single character via OpenRouter.
     */
    public function generateOne(Request $request, string $character): JsonResponse
    {
        if (! in_array($character, Room::ALL_CHARACTERS, true)) {
            return response()->json([
                'message' => "Unknown character '{$character}'.",
                'allowed_characters' => Room::ALL_CHARACTERS,
            ], 404);
        }

        set_time_limit(120);

        $validated = $request->validate([
            'prompt' => ['nullable', 'string', 'min:10', 'max:2000'],
            'format' => ['nullable', 'string', Rule::in(CharacterSoundGenerator::SUPPORTED_FORMATS)],
        ]);

        try {
            $result = $this->generator->generateForCharacter(
                $character,
                $validated['prompt'] ?? null,
                $validated['format'] ?? 'mp3',
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
