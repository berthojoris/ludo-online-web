<?php

namespace App\Http\Controllers;

use App\Models\QuickMatchQueue;
use App\Services\QuickMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuickMatchController extends Controller
{
    public function __construct(private QuickMatchService $quickMatch) {}

    public function join(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'players' => ['required', 'integer', Rule::in(QuickMatchQueue::POOLS)],
            'name' => ['required', 'string', 'min:1', 'max:24'],
        ]);

        return response()->json(
            $this->quickMatch->join($request, (int) $validated['players'], (string) $validated['name']),
        );
    }

    public function status(Request $request): JsonResponse
    {
        $pool = (int) $request->query('players', 4);

        return response()->json(
            $this->quickMatch->touchStatus($request, in_array($pool, QuickMatchQueue::POOLS, true) ? $pool : 4),
        );
    }

    public function cancel(Request $request): JsonResponse
    {
        $this->quickMatch->cancel($request);

        return response()->json(['ok' => true]);
    }

    public function fill(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'players' => ['required', 'integer', Rule::in(QuickMatchQueue::POOLS)],
        ]);

        return response()->json(
            $this->quickMatch->fillBots($request, (int) $validated['players']),
        );
    }
}
