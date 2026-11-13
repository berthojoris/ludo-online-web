<?php

use App\Http\Controllers\PageController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoomController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home'])->name('home');

Route::get('/how-it-works', [PageController::class, 'howItWorks'])->name('how-it-works');

Route::get('/play', [PageController::class, 'play'])->name('play');

Route::get('/room', [PageController::class, 'room'])->name('room');
Route::post('/rooms', [RoomController::class, 'store'])->name('rooms.store');
Route::patch('/rooms/{code}/settings', [RoomController::class, 'updateSettings'])->name('rooms.settings');
Route::post('/rooms/{code}/seat', [RoomController::class, 'selectSeat'])->name('rooms.seat');
Route::post('/rooms/{code}/name', [RoomController::class, 'updateName'])->name('rooms.name');
Route::post('/rooms/{code}/ready', [RoomController::class, 'toggleReady'])->name('rooms.ready');
Route::post('/rooms/{code}/start', [RoomController::class, 'start'])->name('rooms.start');
Route::post('/rooms/{code}/end', [RoomController::class, 'end'])->name('rooms.end');
Route::post('/rooms/{code}/match/roll', [RoomController::class, 'roll'])->name('rooms.match.roll');
Route::post('/rooms/{code}/match/move', [RoomController::class, 'move'])->name('rooms.match.move');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
