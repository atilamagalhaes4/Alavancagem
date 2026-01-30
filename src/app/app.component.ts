import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {

  constructor(private router: Router) {
    /*    this.clearTutorialFlag();*/
    this.initializeApp();
    this.checkTutorial();

  }

  async initializeApp() {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (e) {
      console.warn('StatusBar plugin não disponível');
    }
  }
  checkTutorial() {
    const seen = localStorage.getItem('tutorialSeen');
    if (!seen) {
      this.router.navigateByUrl('/tutorial', { replaceUrl: true });
    }
  }

  // Função para limpar o tutorial e poder refazer (chame de algum lugar para testes)
  clearTutorialFlag() {
    localStorage.removeItem('tutorialSeen');
    localStorage.removeItem('alavancagensData');

  }

}
