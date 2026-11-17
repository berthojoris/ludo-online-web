<?php

namespace App\Http\Middleware;

use App\Services\PlayerResume;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the per-room `ludo_resume_<CODE>` cookies from piling up in a browser.
 * Runs after the controller so cookies the request just queued are respected.
 */
class PruneStaleResumeCookies
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        PlayerResume::pruneStale($request);

        return $response;
    }
}
