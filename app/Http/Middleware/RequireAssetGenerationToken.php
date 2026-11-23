<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAssetGenerationToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('ludo.asset_generation_token');

        if ($expected === '' || ! hash_equals($expected, (string) $request->bearerToken())) {
            abort(404);
        }

        return $next($request);
    }
}
