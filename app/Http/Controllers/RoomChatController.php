<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\PlayerResume;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoomChatController extends Controller
{
    private function participant(Request $request, string $code): array
    {
        RoomController::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();
        $player = PlayerResume::find($request, $room);
        abort_unless($player && $player->seat_color && ! $player->is_computer, 403);
        abort_unless($room->status === 'started', 422, 'Permainan belum dimulai atau sudah berakhir.');

        return [$room, $player];
    }

    public function index(Request $request, string $code): JsonResponse
    {
        [$room] = $this->participant($request, $code);
        $after = max(0, (int) $request->query('after', 0));
        $messages = DB::table('room_messages')->where('room_id', $room->id)
            ->where('id', '>', $after)->orderBy('id')->limit(100)->get();

        return response()->json(['messages' => $messages]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        [$room, $player] = $this->participant($request, $code);
        $validated = $request->validate(['message' => ['required', 'string', 'max:200']]);
        $message = trim($validated['message']);
        if ($message === '') {
            throw ValidationException::withMessages(['message' => 'Pesan tidak boleh kosong.']);
        }

        $id = DB::table('room_messages')->insertGetId([
            'room_id' => $room->id,
            'room_player_id' => $player->id,
            'name' => $player->name,
            'seat_color' => $player->seat_color,
            'message' => $message,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => DB::table('room_messages')->where('id', $id)->first()], 201);
    }
}
