<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Room Creation Password
    |--------------------------------------------------------------------------
    |
    | Static access password required before a visitor may create a room. It is
    | verified on the server so the value never reaches the browser bundle.
    |
    */

    'room_password' => env('ROOM_CREATE_PASSWORD', 'malaquena'),

];
