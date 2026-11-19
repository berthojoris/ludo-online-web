<?php

use App\Http\Controllers\BackgroundMusicController;
use App\Http\Controllers\CharacterKillAnimationController;
use App\Http\Controllers\CharacterSoundController;
use App\Http\Controllers\ClientIssueController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomChatController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home'])->name('home');

Route::get('/how-it-works', [PageController::class, 'howItWorks'])->name('how-it-works');

Route::get('/play', [PageController::class, 'play'])->name('play');

Route::get('/room', [PageController::class, 'room'])->name('room');
Route::post('/rooms', [RoomController::class, 'store'])->name('rooms.store');
Route::patch('/rooms/{code}/settings', [RoomController::class, 'updateSettings'])->name('rooms.settings');
Route::post('/rooms/{code}/randomize', [RoomController::class, 'randomize'])->name('rooms.randomize');
Route::post('/rooms/{code}/seat', [RoomController::class, 'selectSeat'])->name('rooms.seat');
Route::post('/rooms/{code}/name', [RoomController::class, 'updateName'])->name('rooms.name');
Route::patch('/rooms/{code}/players/{player}/name', [RoomController::class, 'updatePlayerName'])->name('rooms.players.name');
Route::post('/rooms/{code}/ready', [RoomController::class, 'toggleReady'])->name('rooms.ready');
Route::post('/rooms/{code}/start', [RoomController::class, 'start'])->name('rooms.start');
Route::post('/rooms/{code}/end', [RoomController::class, 'end'])->name('rooms.end');
Route::post('/rooms/{code}/match/roll', [RoomController::class, 'roll'])->name('rooms.match.roll');
Route::post('/rooms/{code}/match/move', [RoomController::class, 'move'])->name('rooms.match.move');
Route::get('/rooms/{code}/chat', [RoomChatController::class, 'index'])->name('rooms.chat.index');
Route::post('/rooms/{code}/chat', [RoomChatController::class, 'store'])->middleware('throttle:30,1')->name('rooms.chat.store');
Route::post('/client-issues', [ClientIssueController::class, 'store'])
    ->middleware('throttle:12,1')
    ->name('client-issues.store');

Route::prefix('api/sound-effects')->name('sound-effects.')->group(function () {
    Route::get('/characters', [CharacterSoundController::class, 'index'])->name('characters.index');
    Route::post('/characters/generate', [CharacterSoundController::class, 'generateAll'])
        ->middleware('throttle:6,1')
        ->name('characters.generate-all');
    Route::post('/characters/{character}/generate', [CharacterSoundController::class, 'generateOne'])
        ->middleware('throttle:15,1')
        ->name('characters.generate');
    Route::get('/background-music', [BackgroundMusicController::class, 'show'])->name('background-music.show');
    Route::post('/background-music/generate', [BackgroundMusicController::class, 'generate'])
        ->middleware('throttle:3,1')
        ->name('background-music.generate');
});

Route::prefix('api/kill-animations')->name('kill-animations.')->group(function () {
    Route::get('/characters', [CharacterKillAnimationController::class, 'index'])->name('characters.index');
    Route::post('/characters/generate', [CharacterKillAnimationController::class, 'generateAll'])
        ->middleware('throttle:6,1')
        ->name('characters.generate-all');
    Route::post('/characters/{character}/generate', [CharacterKillAnimationController::class, 'generateOne'])
        ->middleware('throttle:15,1')
        ->name('characters.generate');
});

require __DIR__.'/auth.php';
