import { inject } from '@angular/core';
import { Route, Router, Routes } from '@angular/router';
import { contentRoutes } from './content.routes';
import { preparePage, savedLanguageHome } from './core/page-context';
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
		path: '', pathMatch: 'full', component: LoadingPage,
		// Returning visitors skip the splash and language choice and go straight to the home page they last used.
		canActivate: [() => {
			const home = savedLanguageHome();
			return home ? inject(Router).parseUrl(home) : true;
		}],
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