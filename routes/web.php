<?php

use App\Http\Controllers\BackgroundMusicController;
use App\Http\Controllers\BroadcastAuthorizationController;
use App\Http\Controllers\CharacterKillAnimationController;
use App\Http\Controllers\CharacterSoundController;
use App\Http\Controllers\ClientIssueController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\QuickMatchController;
use App\Http\Controllers\RoomChatController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomHandoffController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home'])->name('home');

// Room broadcasts are private. Guests participate without an account, so the
// endpoint validates the same room membership used by the room and match flow
// instead of Laravel's user-only broadcast auth.
Route::post('/broadcasting/room-auth', [BroadcastAuthorizationController::class, 'authenticateRoom'])
    ->name('broadcasting.room-auth');

Route::get('/how-it-works', [PageController::class, 'howItWorks'])->name('how-it-works');

Route::get('/play', [PageController::class, 'play'])->name('play');

Route::get('/room', [PageController::class, 'room'])->name('room');
Route::get('/quick-match', [PageController::class, 'quickMatch'])->name('quick-match');
Route::post('/quick-match/join', [QuickMatchController::class, 'join'])->middleware('throttle:20,1')->name('quick-match.join');
Route::get('/quick-match/status', [QuickMatchController::class, 'status'])->middleware('throttle:120,1')->name('quick-match.status');
Route::post('/quick-match/cancel', [QuickMatchController::class, 'cancel'])->middleware('throttle:20,1')->name('quick-match.cancel');
Route::post('/quick-match/fill', [QuickMatchController::class, 'fill'])->middleware('throttle:10,1')->name('quick-match.fill');
Route::post('/rooms', [RoomController::class, 'store'])->name('rooms.store');
Route::patch('/rooms/{code}/settings', [RoomController::class, 'updateSettings'])->name('rooms.settings');
Route::post('/rooms/{code}/randomize', [RoomController::class, 'randomize'])->name('rooms.randomize');
Route::post('/rooms/{code}/seat', [RoomController::class, 'selectSeat'])->name('rooms.seat');
Route::post('/rooms/{code}/name', [RoomController::class, 'updateName'])->name('rooms.name');
Route::patch('/rooms/{code}/players/{player}/name', [RoomController::class, 'updatePlayerName'])->name('rooms.players.name');
Route::post('/rooms/{code}/ready', [RoomController::class, 'toggleReady'])->name('rooms.ready');
Route::post('/rooms/{code}/start', [RoomController::class, 'start'])->name('rooms.start');
Route::post('/rooms/{code}/end', [RoomController::class, 'end'])->name('rooms.end');
Route::post('/rooms/{code}/leave', [RoomController::class, 'leave'])->name('rooms.leave');
Route::post('/rooms/{code}/heartbeat', [RoomController::class, 'heartbeat'])->name('rooms.heartbeat');
Route::post('/rooms/{code}/match/roll', [RoomController::class, 'roll'])->middleware('throttle:60,1')->name('rooms.match.roll');
Route::post('/rooms/{code}/match/move', [RoomController::class, 'move'])->middleware('throttle:60,1')->name('rooms.match.move');
Route::post('/rooms/{code}/handoff', [RoomHandoffController::class, 'store'])->middleware('throttle:20,1')->name('rooms.handoff.store');
Route::get('/rooms/{code}/continue', [RoomHandoffController::class, 'show'])->name('rooms.continue');
Route::post('/rooms/{code}/continue', [RoomHandoffController::class, 'claim'])->middleware('throttle:10,1')->name('rooms.continue.store');
Route::get('/switch', [RoomHandoffController::class, 'showSwitch'])->name('switch');
Route::post('/switch', [RoomHandoffController::class, 'claimByCode'])->middleware('throttle:10,1')->name('switch.store');
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
