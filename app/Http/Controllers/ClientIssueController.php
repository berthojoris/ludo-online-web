<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\PlayerResume;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ClientIssueController extends Controller
{
    public function store(Request $request): Response
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000', 'regex:/\S/'],
            'stack' => ['nullable', 'string', 'max:10000'],
            'source' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'level' => ['nullable', 'in:error,warning'],
            'room_code' => ['nullable', 'string', 'size:6'],
            'action' => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'page' => ['nullable', 'string', 'max:255', 'starts_with:/'],
            'client_timestamp' => ['nullable', 'date'],
            'context' => ['nullable', 'array:connection,http_status,state_version,current_version'],
            'context.connection' => ['nullable', 'string', 'max:30'],
            'context.http_status' => ['nullable', 'integer', 'min:100', 'max:599'],
            'context.state_version' => ['nullable', 'integer', 'min:0'],
            'context.current_version' => ['nullable', 'integer', 'min:0'],
        ]);

        $code = isset($validated['room_code'])
            ? strtoupper($validated['room_code'])
            : null;
        $room = $code ? Room::where('code', $code)->first() : null;
        $player = $room ? PlayerResume::find($request, $room) : null;
        $message = preg_replace('/\s+/', ' ', trim($validated['message'])) ?? $validated['message'];

        Log::log($validated['level'] ?? 'error', 'Client application issue reported.', array_filter([
            'message' => $message,
            'stack' => $validated['stack'] ?? null,
            'source' => $validated['source'],
            'room_code' => $code,
            'player_id' => $player?->id,
            'user_id' => $request->user()?->id,
            'action' => $validated['action'] ?? null,
            'page' => $validated['page'] ?? null,
            'client_timestamp' => $validated['client_timestamp'] ?? null,
            'context' => $validated['context'] ?? null,
        ], fn (mixed $value): bool => $value !== null));

        return response()->noContent();
    }
}
