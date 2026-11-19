<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\PlayerResume;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Moves a seated player to another device (for example from a PC to a phone).
 *
 * The device that is already playing asks for a short-lived six digit pairing
 * code. The other device opens `/rooms/{code}/continue`, types that code and is
 * bound to the very same player row, so it sees the stored match state and can
 * keep playing. Both devices stay active afterwards.
 */
class RoomHandoffController extends Controller
{
    public const CODE_TTL_SECONDS = 600;

    /**
     * Wrong codes a room accepts per lockout window before every pending
     * pairing code of that room is revoked. Together with the per-IP route
     * throttle this keeps a six digit code out of reach of brute force.
     */
    public const MAX_FAILED_ATTEMPTS = 10;

    public const LOCKOUT_SECONDS = 600;

    private const ACTIVE_STATUSES = ['waiting', 'started'];

    public function store(Request $request, string $code): JsonResponse
    {
        RoomController::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();
        $player = PlayerResume::find($request, $room);

        abort_unless($player && ! $player->is_computer, 403, 'Kamu bukan peserta ruang ini.');
        abort_unless(in_array($room->status, self::ACTIVE_STATUSES, true), 422, 'Permainan di ruang ini sudah berakhir.');

        $pairingCode = DB::transaction(function () use ($room, $player): string {
            $locked = RoomPlayer::whereKey($player->id)->lockForUpdate()->firstOrFail();

            do {
                $candidate = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                $hash = self::hashCode($room, $candidate);
                $taken = $room->players()
                    ->whereKeyNot($locked->id)
                    ->where('handoff_code_hash', $hash)
                    ->where('handoff_expires_at', '>', now())
                    ->exists();
            } while ($taken);

            $locked->forceFill([
                'handoff_code_hash' => $hash,
                'handoff_expires_at' => now()->addSeconds(self::CODE_TTL_SECONDS),
            ])->save();

            return $candidate;
        });

        return response()->json([
            'pairing_code' => $pairingCode,
            'expires_in' => self::CODE_TTL_SECONDS,
            'continue_url' => route('rooms.continue', ['code' => $room->code]),
        ]);
    }

    public function show(Request $request, string $code): Response|RedirectResponse
    {
        $code = strtoupper(trim($code));
        $room = Room::where('code', $code)->first();
        $roomError = null;

        if (! $room) {
            $roomError = 'Ruang tidak ditemukan. Periksa kembali tautanmu.';
        } elseif (! in_array($room->status, self::ACTIVE_STATUSES, true)) {
            $roomError = 'Permainan di ruang ini sudah berakhir.';
        } else {
            $me = PlayerResume::find($request, $room);

            // This browser already sits in the room: no pairing needed.
            if ($me && ! $me->is_computer) {
                return $this->redirectToRoom($room);
            }
        }

        return Inertia::render('Continue', [
            'roomCode' => $code,
            'roomError' => $roomError,
            'codeLength' => 6,
        ]);
    }

    public function claim(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'pairing_code' => ['required', 'digits:6'],
        ], [
            'pairing_code.required' => 'Masukkan 6 digit kode dari perangkat yang sedang bermain.',
            'pairing_code.digits' => 'Kode harus terdiri dari 6 angka.',
        ]);

        $room = Room::where('code', strtoupper($code))->first();

        if (! $room || ! in_array($room->status, self::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'pairing_code' => 'Ruang tidak ditemukan atau permainan sudah berakhir.',
            ]);
        }

        $limiterKey = 'room-handoff:'.$room->code;

        if (RateLimiter::tooManyAttempts($limiterKey, self::MAX_FAILED_ATTEMPTS)) {
            throw ValidationException::withMessages([
                'pairing_code' => 'Terlalu banyak percobaan. Buat kode baru di perangkat yang sedang bermain, lalu coba lagi nanti.',
            ]);
        }

        $hash = self::hashCode($room, $validated['pairing_code']);

        $player = DB::transaction(function () use ($room, $hash): ?RoomPlayer {
            $player = $room->players()
                ->where('is_computer', false)
                ->where('handoff_code_hash', $hash)
                ->where('handoff_expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            // Single use: the code is gone as soon as one device claims it.
            $player?->forceFill([
                'handoff_code_hash' => null,
                'handoff_expires_at' => null,
            ])->save();

            return $player;
        });

        if (! $player) {
            RateLimiter::hit($limiterKey, self::LOCKOUT_SECONDS);

            if (RateLimiter::tooManyAttempts($limiterKey, self::MAX_FAILED_ATTEMPTS)) {
                $room->players()
                    ->whereNotNull('handoff_code_hash')
                    ->update(['handoff_code_hash' => null, 'handoff_expires_at' => null]);
            }

            throw ValidationException::withMessages([
                'pairing_code' => 'Kode tidak cocok atau sudah kedaluwarsa. Buat kode baru di perangkat yang sedang bermain.',
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put(PlayerResume::SESSION_TOKEN, $player->player_token);

        if ($player->is_host) {
            $request->session()->put('ludo_host_room_code', $room->code);
        }

        PlayerResume::remember($request, $player, $room->code);

        return $this->redirectToRoom($room);
    }

    public static function hashCode(Room $room, string $pairingCode): string
    {
        return hash_hmac('sha256', $room->id.'|'.$pairingCode, (string) config('app.key'));
    }

    private function redirectToRoom(Room $room): RedirectResponse
    {
        return $room->status === 'started'
            ? redirect()->route('play', ['room' => $room->code])
            : redirect()->route('room', ['code' => $room->code]);
    }
}
