<?php

namespace App\Services;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Http\Request;

/**
 * Keeps a browser attached to the seat it already occupies.
 *
 * A guest is identified by the token stored in the session. When that session is
 * lost (expired session, browser closed, cookie wiped) the long lived
 * `ludo_resume_<CODE>` cookie lets the browser reclaim the very same player row
 * instead of joining as a brand new player, so the match continues from the
 * state the server already stored instead of restarting.
 */
class PlayerResume
{
    public const SESSION_TOKEN = 'ludo_player_token';

    public const COOKIE_PREFIX = 'ludo_resume_';

    public const LAST_ROOM_COOKIE = 'ludo_last_room';

    public const COOKIE_MINUTES = 60 * 24 * 30;

    public static function cookieName(string $code): string
    {
        return self::COOKIE_PREFIX.strtoupper($code);
    }

    public static function lastRoom(Request $request): ?string
    {
        $code = $request->cookie(self::LAST_ROOM_COOKIE);

        return is_string($code) && $code !== '' ? strtoupper($code) : null;
    }

    public static function remember(Request $request, RoomPlayer $player, string $code): void
    {
        $token = $player->resume_token;

        if (! is_string($token) || $token === '') {
            return;
        }

        $secure = $request->isSecure();

        cookie()->queue(cookie(
            self::cookieName($code),
            $token,
            self::COOKIE_MINUTES,
            '/',
            null,
            $secure,
            true,
            'lax'
        ));

        cookie()->queue(cookie(
            self::LAST_ROOM_COOKIE,
            strtoupper($code),
            self::COOKIE_MINUTES,
            '/',
            null,
            $secure,
            true,
            'lax'
        ));
    }

    public static function forget(string $code): void
    {
        cookie()->queue(cookie()->forget(self::cookieName($code)));
    }

    public static function find(Request $request, Room $room): ?RoomPlayer
    {
        $token = $request->session()->get(self::SESSION_TOKEN);

        if (is_string($token) && $token !== '') {
            $player = $room->players()->where('player_token', $token)->first();

            if ($player) {
                return $player;
            }
        }

        $resume = $request->cookie(self::cookieName($room->code));

        if (is_string($resume) && $resume !== '') {
            $player = $room->players()->where('resume_token', $resume)->first();

            if ($player) {
                return self::rebind($request, $player, $room);
            }
        }

        $user = $request->user();

        if ($user) {
            $player = $room->players()->where('user_id', $user->id)->first();

            if ($player) {
                return self::rebind($request, $player, $room);
            }
        }

        return null;
    }

    private static function rebind(Request $request, RoomPlayer $player, Room $room): RoomPlayer
    {
        if (is_string($player->player_token) && $player->player_token !== '') {
            $request->session()->put(self::SESSION_TOKEN, $player->player_token);
        }

        if ($player->is_host) {
            $request->session()->put('ludo_host_room_code', $room->code);
        }

        return $player;
    }
}
