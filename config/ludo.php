<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Room Creation Password
    |--------------------------------------------------------------------------
    |
    | Access password required before a visitor may create a room. It is
    | verified on the server so the value never reaches the browser bundle.
    | ROOM_CREATE_PASSWORD must be set in every environment; there is no
    | fallback so a missing secret can never silently open room creation.
    |
    */

    'room_password' => env('ROOM_CREATE_PASSWORD'),

    /*
    |--------------------------------------------------------------------------
    | Operator Asset Generation Token
    |--------------------------------------------------------------------------
    |
    | Bearer token required to access the operator asset-generation API routes
    | (sound effects, background music, kill animations). Fails closed when
    | empty so an unconfigured environment never exposes paid API endpoints.
    |
    */

    'asset_generation_token' => env('ASSET_GENERATION_TOKEN'),

];
