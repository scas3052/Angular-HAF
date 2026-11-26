import { inject } from '@angular/core';
import { Route, Router, Routes } from '@angular/router';
import { contentRoutes } from './content.routes';
import { preparePage } from './core/page-context';
import { legacyPageUrls } from './page-urls';
import { LanguagePage, LoadingPage } from './pages/entry';

// Old .html URLs keep working: they redirect to the clean URL and keep any query string and #fragment.
const legacyRedirects: Routes = Object.entries(legacyPageUrls).map(([legacy, path]): Route => ({
	path: legacy, pathMatch: 'full',
	redirectTo: ({ queryParams, fragment }) => inject(Router).createUrlTree(['/' + path], { queryParams, fragment: fragment ?? undefined })
}));

export const routes: Routes = [
	...contentRoutes,
	{
		// Every visit starts with the splash and then the language choice; the last language used is not remembered.
		path: '', pathMatch: 'full', component: LoadingPage,
		title: 'Holy Army Fellowship - Loading',
		resolve: { appearance: preparePage },
		data: { kind: 'loading', styles: ['/src/css/style.css', '/index.css'] }
	},
	{
		path: 'language', component: LanguagePage,
		title: 'Welcome - Holy Army Fellowship',
		resolve: { appearance: preparePage },
		data: { kind: 'language', styles: ['/index.css'] }
	},
	...legacyRedirects,
	{ path: '**', redirectTo: 'language' }
];