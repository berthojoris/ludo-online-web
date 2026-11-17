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

    /**
     * Resume cookies a browser may carry before older ones are expired. Each
     * encrypted cookie adds roughly 360 bytes to every request, and a browser
     * that played dozens of rooms otherwise sends a Cookie header that proxies
     * such as Cloudflare reject (error 520) until the user clears site data.
     */
    public const MAX_RESUME_COOKIES = 5;

    /**
     * Cookies expired per response. Expired cookies are encrypted too, so each
     * one adds about 450 bytes of Set-Cookie header; a small batch keeps the
     * response headers well inside typical proxy buffers.
     */
    public const PRUNE_BATCH = 4;

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

    /**
     * Expires resume cookies the browser no longer needs once it carries more
     * than MAX_RESUME_COOKIES of them: cookies of ended or deleted rooms go
     * first, then the least recently active rooms. The last room and cookies
     * queued by the current request are always kept.
     */
    public static function pruneStale(Request $request): void
    {
        /** @var array<string, string> $namesByCode */
        $namesByCode = [];

        foreach (array_keys($request->cookies->all()) as $name) {
            $name = (string) $name;

            if (str_starts_with($name, self::COOKIE_PREFIX)) {
                $namesByCode[strtoupper(substr($name, strlen(self::COOKIE_PREFIX)))] = $name;
            }
        }

        if (count($namesByCode) <= self::MAX_RESUME_COOKIES) {
            return;
        }

        $liveCodes = Room::whereIn('code', array_keys($namesByCode))
            ->where('status', '!=', 'ended')
            ->orderByDesc('updated_at')
            ->pluck('code')
            ->all();

        $lastRoom = self::lastRoom($request);
        $preferred = in_array($lastRoom, $liveCodes, true) ? [$lastRoom] : [];
        $keep = array_slice(array_values(array_unique([...$preferred, ...$liveCodes])), 0, self::MAX_RESUME_COOKIES);

        $stale = [
            ...array_diff(array_keys($namesByCode), $liveCodes),
            ...array_diff($liveCodes, $keep),
        ];

        $expired = 0;

        foreach ($stale as $code) {
            if ($expired >= self::PRUNE_BATCH) {
                break;
            }

            $name = $namesByCode[$code];

            if (cookie()->hasQueued($name)) {
                continue;
            }

            cookie()->queue(cookie()->forget($name));
            $expired++;
        }
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
