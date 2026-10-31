import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { BookReader, BookReaderState, ReadBook } from '../../features/book-reader';

@Component({
  selector: 'haf-books-te',
  imports: [SiteHeader, SiteFooter, ReadBook, BookReader],
  providers: [BookReaderState],
  templateUrl: './books-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class BooksTeluguPage {



}
