import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ViewChild } from '@angular/core';

@Component({
  selector: 'app-tutorial',
  templateUrl: 'tutorial.page.html',
  standalone: false,
  styleUrls: ['tutorial.page.scss'],
})
export class TutorialPage {

  @ViewChild('tutorialContent', { static: false }) tutorialContent!: IonContent;


  abaAtiva: 'config' | 'apostas' | 'historico' = 'config';
  tutorialActive: boolean = true;

  constructor(
    private route: Router
  ) {}

async mudarAba(aba: 'config' | 'apostas' | 'historico') {
  this.abaAtiva = aba;

  // pequeno delay para o DOM renderizar a nova seção
  setTimeout(() => {
    this.tutorialContent?.scrollToTop(0);
  }, 50);
}


  pularTutorial() {
    this.tutorialActive = false;
    this.route.navigate(["/home"]);
  }
}