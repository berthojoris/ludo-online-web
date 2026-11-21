<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Services\PlayerResume;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BroadcastAuthorizationController extends Controller
{
    private const ROOM_CHANNEL_PATTERN = '/^private-room\.(?<code>[A-Z0-9]{6})$/';

    private const QUICK_MATCH_CHANNEL_PATTERN = '/^private-quick-match\.(?<token>[A-Za-z0-9]{40,64})$/';

    /**
     * Authorize the private room and quick-match channels for both
     * authenticated users and guests. Laravel's default broadcast auth only
     * resolves authenticated users, while this game's seats are claimable
     * without an account, so membership is checked with the same resume
     * identity used by the room and match routes.
     */
    public function authenticateRoom(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'socket_id' => ['required', 'string'],
            'channel_name' => ['required', 'string'],
        ]);

        $channelName = $validated['channel_name'];

        if (preg_match(self::ROOM_CHANNEL_PATTERN, $channelName, $matches)) {
            $room = Room::where('code', $matches['code'])->first();

            if (! $room || ! PlayerResume::find($request, $room)) {
                throw new AccessDeniedHttpException('Kamu bukan peserta ruang ini.');
            }

            return $this->authorizeChannel($validated['socket_id'], $channelName);
        }

        if (preg_match(self::QUICK_MATCH_CHANNEL_PATTERN, $channelName, $matches)) {
            $sessionToken = $request->session()->get(PlayerResume::SESSION_TOKEN);

            if (! is_string($sessionToken) || $sessionToken === '' || ! hash_equals($sessionToken, $matches['token'])) {
                throw new AccessDeniedHttpException('Kamu bukan pemain kanal ini.');
            }

            return $this->authorizeChannel($validated['socket_id'], $channelName);
        }

        throw new AccessDeniedHttpException('Kanal tidak dikenali.');
    }

    private function authorizeChannel(string $socketId, string $channelName): JsonResponse
    {
        $broadcaster = Broadcast::connection();

        if (! $broadcaster instanceof PusherBroadcaster) {
            throw new HttpException(503, 'Kanal privat belum tersedia untuk koneksi broadcast ini.');
        }

        $payload = $broadcaster->getPusher()->authorizeChannel($channelName, $socketId);

        return response()->json(json_decode($payload, true, 512, JSON_THROW_ON_ERROR));
    }
}
