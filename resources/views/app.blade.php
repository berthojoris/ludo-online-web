<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, shrink-to-fit=no, viewport-fit=cover">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#F7F8FA">
        <meta name="color-scheme" content="light">
        <meta name="description" content="Ludo Arena adalah papan Ludo yang bersih dan mengutamakan perangkat mobile untuk pertandingan cepat dan ruang privat.">

        <link rel="icon" type="image/svg+xml" href="/favicon.svg">

        <title inertia>{{ config('app.name', 'Ludo Arena') }}</title>

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
