import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { BookReader, BookReaderState, ReadBook } from '../../features/book-reader';

@Component({
  selector: 'haf-books-en',
  imports: [SiteHeader, SiteFooter, ReadBook, BookReader],
  providers: [BookReaderState],
  templateUrl: './books-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class BooksEnglishPage {



}
