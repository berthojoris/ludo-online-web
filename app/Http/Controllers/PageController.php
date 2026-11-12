<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function home(): Response
    {
        return Inertia::render('Home');
    }

    public function play(): Response
    {
        return Inertia::render('Play');
    }

    public function room(): Response
    {
        return Inertia::render('Room');
    }
}
