import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController, ToastController } from '@ionic/angular';
import { Share } from '@capacitor/share';

interface Aposta {
  numero: number;
  odd: string | number;
  status: 'pendente' | 'vitoria' | 'derrota';
  saldoAntes: number;
  saldoDepois: number;
  print?: string;
}

interface Alavancagem {
  id: string;
  nome: string;
  saldoInicial: number;
  oddPadrao: number;
  quantidadeApostas: number;
  saldoAtual: number;
  apostas: Aposta[];
  dataInicio: string;
  dataFim?: string;
  status: 'ativa' | 'finalizada';
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  // Configuração inicial
  saldoInicial: number = 20;
  oddPadrao: number = 1.40;
  quantidadeApostas: number = 20;
  nomeAlavancagem: string = '';

  // No topo da classe
  printSelecionado: string | null = null;

  // Alavancagem atual
  alavancagemAtual: Alavancagem | null = null;
  mostrarProjecao: boolean = false;

  // Todas as alavancagens
  alavancagens: Alavancagem[] = [];

  // Controle de abas
  abaAtiva: 'config' | 'apostas' | 'historico' = 'config';
  mostrarValores: boolean = true; // por padrão, mostra os valores

  constructor(
    private alertController: AlertController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.carregarDados();
  }

  toggleVisibilidadeValores() {
    this.mostrarValores = !this.mostrarValores;
  }

  // Método auxiliar para formatar valores condicionalmente
  formatarValorSeguro(valor: number): string {
    return this.mostrarValores ? this.formatarMoeda(valor) : '••••••';
  }
  carregarDados() {
    const dados = localStorage.getItem('alavancagensData');
    if (dados) {
      const parsed = JSON.parse(dados);
      this.alavancagens = parsed.alavancagens || [];

      // Carrega a última alavancagem ativa
      const ativaId = parsed.alavancagemAtivaId;
      if (ativaId) {
        this.alavancagemAtual = this.alavancagens.find(a => a.id === ativaId) || null;
        if (this.alavancagemAtual) {
          this.abaAtiva = 'apostas';
        }
      }
    }
  }
private getIndiceProximaAposta(): number {
  if (!this.alavancagemAtual) return 0;

  const apostas = this.alavancagemAtual.apostas;

  // procura a primeira pendente
  const idx = apostas.findIndex(a => a.status === 'pendente');

  return idx === -1 ? apostas.length : idx;
}

async editarSaldoAtual() {
  if (!this.alavancagemAtual) return;

  const alert = await this.alertController.create({
    message: 'Qual seu saldo atual em R$ ?',
    inputs: [
      {
        name: 'saldo',
        type: 'number',
        value: this.alavancagemAtual.saldoAtual,
        placeholder: 'Ex: 1700.00'
      }
    ],
    buttons: [
      {
        text: 'Salvar',
        handler: (form) => {
          const novoSaldo = Number(form.saldo);

          if (isNaN(novoSaldo) || novoSaldo < 0) {
            this.mostrarAlerta('Erro', 'Informe um saldo válido.');
            return false;
          }

          const idxBase = this.getIndiceProximaAposta();

          // 🔒 passado permanece intacto
          if (idxBase === 0) {
            // ainda não teve aposta resolvida
            this.alavancagemAtual!.saldoInicial = novoSaldo;
          } else if (idxBase < this.alavancagemAtual!.apostas.length) {
            // aplica ajuste na próxima aposta
            this.alavancagemAtual!.apostas[idxBase].saldoAntes = novoSaldo;
          }

          // saldo atual vira o novo valor real
          this.alavancagemAtual!.saldoAtual = novoSaldo;

          // recalcula apenas do ponto correto em diante
          this.atualizarSaldosAPartir(idxBase, novoSaldo);

          this.salvarDados();
          return true;
        }
      },
      { text: 'Cancelar', role: 'cancel' }
    ]
  });

  await alert.present();
}

  salvarDados() {
    const dados = {
      alavancagens: this.alavancagens,
      alavancagemAtivaId: this.alavancagemAtual?.id || null
    };
    localStorage.setItem('alavancagensData', JSON.stringify(dados));
  }

  async iniciarNovaAlavancagem() {
    if (this.saldoInicial <= 0 || this.oddPadrao < 1.01 || this.quantidadeApostas < 1) {
      await this.mostrarAlerta('Erro', 'Insira valores válidos!');
      return;
    }

    const nome = this.nomeAlavancagem.trim() || `Alavancagem ${this.alavancagens.length + 1}`;

    const novaAlavancagem: Alavancagem = {
      id: Date.now().toString(),
      nome: nome,
      saldoInicial: this.saldoInicial,
      oddPadrao: this.oddPadrao,
      quantidadeApostas: this.quantidadeApostas,
      saldoAtual: this.saldoInicial,
      apostas: [],
      dataInicio: new Date().toISOString(),
      status: 'ativa'
    };

    for (let i = 1; i <= this.quantidadeApostas; i++) {
      novaAlavancagem.apostas.push({
        numero: i,
        odd: this.oddPadrao.toFixed(2),
        status: 'pendente',
        saldoAntes: 0,
        saldoDepois: 0
      });
    }

    this.alavancagemAtual = novaAlavancagem;
    this.alavancagens.push(novaAlavancagem);
    this.atualizarSaldos();
    this.salvarDados();
    this.abaAtiva = 'apostas';
    this.nomeAlavancagem = '';
  }
  async compartilharPrint(base64: string) {
    try {
      await Share.share({
        title: 'Print da aposta',
        text: 'Print salvo no app',
        url: base64, // sim, o Share aceita dataUrl
        dialogTitle: 'Compartilhar print'
      });
    } catch (err) {
      console.error('Erro ao compartilhar print', err);
    }
  }

  async selecionarAlavancagem() {
    const ativas = this.alavancagens.filter(a => a.status === 'ativa');

    if (ativas.length === 0) {
      await this.mostrarAlerta('Aviso', 'Nenhuma alavancagem ativa encontrada.');
      return;
    }

    const inputs = ativas.map(a => ({
      type: 'radio' as const,
      label: `${a.nome} - ${this.formatarMoeda(a.saldoAtual)}`,
      value: a.id,
      checked: a.id === this.alavancagemAtual?.id
    }));

    const alert = await this.alertController.create({
      message: 'Selecionar Alavancagem',
      inputs: inputs,
      buttons: [
        {
          text: 'Selecionar',
          handler: (id) => {
            this.alavancagemAtual = this.alavancagens.find(a => a.id === id) || null;
            this.salvarDados();
            this.abaAtiva = 'apostas';
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  // Recalcula saldos a partir do início (mantendo resultados)
  atualizarSaldos() {
    if (!this.alavancagemAtual) return;

    let saldoCorrente = this.alavancagemAtual.saldoInicial;

    for (let i = 0; i < this.alavancagemAtual.apostas.length; i++) {
      const aposta = this.alavancagemAtual.apostas[i];

      // Se a aposta anterior foi derrota, tudo zera dali em diante
      if (i > 0 && this.alavancagemAtual.apostas[i - 1].status === 'derrota') {
        aposta.saldoAntes = 0;
        aposta.saldoDepois = 0;
        continue;
      }

      aposta.saldoAntes = saldoCorrente;

      const oddNum = parseFloat(aposta.odd.toString());
      if (aposta.status === 'vitoria') {
        aposta.saldoDepois = aposta.saldoAntes * oddNum;
        saldoCorrente = aposta.saldoDepois;
      } else if (aposta.status === 'derrota') {
        aposta.saldoDepois = 0;
        saldoCorrente = 0;
      } else {
        aposta.saldoDepois = aposta.saldoAntes * oddNum;
      }
    }

    this.alavancagemAtual.saldoAtual = saldoCorrente;
  }

  // Recalcula a partir de um índice usando baseSaldo para a aposta startIndex
  atualizarSaldosAPartir(startIndex: number, baseSaldo: number) {
    if (!this.alavancagemAtual) return;
    const apostas = this.alavancagemAtual.apostas;
    let saldoCorrente = baseSaldo;

    for (let i = startIndex; i < apostas.length; i++) {
      const aposta = apostas[i];

      // Se a aposta anterior (dentro deste laço) foi derrota, zera e continua
      if (i > 0 && apostas[i - 1].status === 'derrota') {
        aposta.saldoAntes = 0;
        aposta.saldoDepois = 0;
        saldoCorrente = 0;
        continue;
      }

      aposta.saldoAntes = saldoCorrente;

      const oddNum = parseFloat(aposta.odd.toString()) || 1.0;
      if (aposta.status === 'vitoria') {
        aposta.saldoDepois = aposta.saldoAntes * oddNum;
        saldoCorrente = aposta.saldoDepois;
      } else if (aposta.status === 'derrota') {
        aposta.saldoDepois = 0;
        saldoCorrente = 0;
      } else {
        aposta.saldoDepois = aposta.saldoAntes * oddNum;
      }
    }

    // Atualiza o saldoAtual tomando em conta apostas anteriores até startIndex-1
    // Se startIndex === 0 -> saldoAtual é resultado do laço
    // Se startIndex > 0 -> precisa recuperar saldoCorrente a partir de apostas[0..startIndex-1]
    if (startIndex === 0) {
      this.alavancagemAtual.saldoAtual = this.alavancagemAtual.apostas.length ? this.alavancagemAtual.apostas[this.alavancagemAtual.apostas.length - 1].saldoDepois : baseSaldo;
    } else {
      // calcula saldoCorrente baseado nas apostas anteriores
      let saldoBefore = this.alavancagemAtual.saldoInicial;
      for (let j = 0; j < startIndex; j++) {
        const ap = this.alavancagemAtual.apostas[j];
        if (ap.status === 'vitoria') {
          saldoBefore = ap.saldoDepois;
        } else if (ap.status === 'derrota') {
          saldoBefore = 0;
        } else {
          saldoBefore = ap.saldoDepois;
        }
      }
      // saldoAtual é saldo depois do último cálculo global:
      const ultimo = this.alavancagemAtual.apostas[this.alavancagemAtual.apostas.length - 1];
      this.alavancagemAtual.saldoAtual = ultimo ? ultimo.saldoDepois : saldoBefore;
    }
  }

  // --- FUNÇÕES NOVAS PARA EDITAR / LOCALIZAR APOS -->
  getIndexByNumero(numero: number): number {
    if (!this.alavancagemAtual) return -1;
    return this.alavancagemAtual.apostas.findIndex(a => a.numero === numero);
  }

  getApostaOdd(numero: number): string {
    const idx = this.getIndexByNumero(numero);
    if (idx === -1 || !this.alavancagemAtual) return '';
    return this.alavancagemAtual.apostas[idx].odd.toString();
  }

  // Ajustada para receber número da aposta
  formatarOddInputRealTime(event: any, apostaNumero: number) {
    if (!this.alavancagemAtual) return;
    const idx = this.getIndexByNumero(apostaNumero);
    if (idx === -1) return;

    let valor = event.target.value;

    // Remove tudo que não é número ou ponto
    valor = valor.replace(/[^0-9.]/g, '');

    // Remove pontos duplicados (deixa só o primeiro)
    const partes = valor.split('.');
    if (partes.length > 2) {
      valor = partes[0] + '.' + partes.slice(1).join('');
    }

    // Limita razoavelmente (até 5 caracteres)
    if (valor.length > 6) {
      valor = valor.substring(0, 6);
    }

    // Atualiza visual
    this.alavancagemAtual.apostas[idx].odd = valor;

    // Recalculo com valor temporário
    let numero = parseFloat(valor);

    if (isNaN(numero) || numero <= 1.0) {
      // não permitir odd <= 1 ao salvar definitivo; aqui apenas evita NaN ao calcular
      numero = 1.0;
    }

    const aposta = this.alavancagemAtual.apostas[idx];
    if (aposta.status === 'pendente') {
      aposta.saldoDepois = aposta.saldoAntes * numero;
    }

    // Recalcula saldos a partir desta aposta para propagar mudanças visuais
    this.atualizarSaldosAPartir(idx, aposta.saldoAntes);
    this.salvarDados();
  }

  // Wrapper para registrar por numero
  async registrarResultadoPorNumero(numero: number, resultado: 'vitoria' | 'derrota') {
    const idx = this.getIndexByNumero(numero);
    if (idx === -1) return;
    await this.registrarResultado(idx, resultado);
  }

  async adicionarPrintPorNumero(numero: number) {
    const idx = this.getIndexByNumero(numero);
    if (idx === -1) return;
    await this.adicionarPrint(idx);
  }

  removerPrintPorNumero(numero: number) {
    const idx = this.getIndexByNumero(numero);
    if (idx === -1) return;
    this.removerPrint(idx);
  }


  // EDITAR ODD via caneta (qualquer status)
  async editarOdd(numero: number) {
    if (!this.alavancagemAtual) return;
    const idx = this.getIndexByNumero(numero);
    if (idx === -1) return;
    const aposta = this.alavancagemAtual.apostas[idx];

    const alert = await this.alertController.create({
      message: `Editar Odd`,
      inputs: [
        {
          name: 'odd',
          type: 'number',
          value: aposta.odd?.toString() || this.alavancagemAtual.oddPadrao.toString(),
          placeholder: '1.40'
        }
      ],
      buttons: [
        {
          text: 'Salvar',
          handler: (form) => {
            const raw = (form.odd || '').toString().replace(',', '.').trim();
            const oddNum = parseFloat(raw);
            if (isNaN(oddNum) || oddNum <= 1.0) {
              this.mostrarAlerta('Erro', 'A odd deve ser um número válido maior que 1.00');
              return false; // mantém o alerta aberto
            }

            this.alavancagemAtual!.apostas[idx].odd = oddNum.toFixed(2);
            // após alterar odd, recalcula todos os saldos (manter resultados antigos)
            this.atualizarSaldos();
            this.salvarDados();
            return true;
          }
        },
        { text: 'Cancelar', role: 'cancel' }
      ]
    });
    await alert.present();
  }


  finalizarResultado(index: number, resultado: 'vitoria' | 'derrota') {
    if (!this.alavancagemAtual) return;

    this.alavancagemAtual.apostas[index].status = resultado;
    this.atualizarSaldos();
    this.salvarDados();
  }

  async adicionarPrint(index: number) {
    if (!this.alavancagemAtual) return;

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      this.alavancagemAtual.apostas[index].print = image.dataUrl;
      this.salvarDados();
    } catch (error) {
      console.error('Erro ao adicionar print:', error);
    }
  }

  removerPrint(index: number) {
    if (!this.alavancagemAtual) return;
    this.alavancagemAtual.apostas[index].print = undefined;
    this.salvarDados();
  }

  async finalizarAlavancagem() {
    if (!this.alavancagemAtual) return;

    const alert = await this.alertController.create({
      message: 'Deseja finalizar esta alavancagem e movê-la para o histórico?',
      buttons: [
        {
          text: 'Finalizar',
          handler: () => {
            if (this.alavancagemAtual) {
              this.alavancagemAtual.status = 'finalizada';
              this.alavancagemAtual.dataFim = new Date().toISOString();
              this.salvarDados();
              this.alavancagemAtual = null;
              this.abaAtiva = 'config';
            }
          }
        },
                {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async excluirAlavancagem(id: string) {
    const alert = await this.alertController.create({
      message: 'Deseja realmente excluir esta alavancagem do histórico?',
      buttons: [
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            this.alavancagens = this.alavancagens.filter(a => a.id !== id);
            this.salvarDados();
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: "color: red;"
        }
      ]
    });

    await alert.present();
  }

  async mostrarAlerta(titulo: string, mensagem: string) {
    const alert = await this.alertController.create({
      header: titulo,
      message: mensagem,
      buttons: ['OK']
    });
    await alert.present();
  }

  get apostasVisiveis(): Aposta[] {
    if (!this.alavancagemAtual) return [];

    const apostas = this.alavancagemAtual.apostas;
    const primeiraDerrota = apostas.findIndex(a => a.status === 'derrota');

    if (primeiraDerrota !== -1) {
      return apostas.slice(0, primeiraDerrota + 1);
    }

    const ultimaVitoria = apostas.map((a, i) => a.status === 'vitoria' ? i : -1)
      .filter(i => i !== -1)
      .pop();

    if (ultimaVitoria !== undefined) {
      return apostas.slice(0, ultimaVitoria + 2);
    }

    return [apostas[0]];
  }

  get alavancagensFinalizadas(): Alavancagem[] {
    return this.alavancagens.filter(a => a.status === 'finalizada').reverse();
  }

  get alavancagensAtivas(): Alavancagem[] {
    return this.alavancagens.filter(a => a.status === 'ativa');
  }

  calcularProjecaoTotal(): number {
    if (!this.alavancagemAtual) return 0;

    let projecao = this.alavancagemAtual.saldoInicial;
    for (const aposta of this.alavancagemAtual.apostas) {
      const oddNum = parseFloat(aposta.odd.toString());
      projecao *= oddNum;
    }
    return projecao;
  }

  calcularProjecaoRestante(): number {
    if (!this.alavancagemAtual) return 0;

    const apostas = this.alavancagemAtual.apostas;
    const ultimaVitoria = apostas.map((a, i) => a.status === 'vitoria' ? i : -1)
      .filter(i => i !== -1)
      .pop();

    let projecao = this.alavancagemAtual.saldoAtual;
    const inicio = ultimaVitoria !== undefined ? ultimaVitoria + 1 : 0;

    for (let i = inicio; i < apostas.length; i++) {
      const oddNum = parseFloat(apostas[i].odd.toString());
      projecao *= oddNum;
    }

    return projecao;
  }



  get statusProjecao(): 'acima' | 'abaixo' | 'igual' {
    const perc = this.percentualMeta;
    if (perc > 1) return 'acima';
    if (perc < -1) return 'abaixo';
    return 'igual';
  }

  toggleProjecao() {
    this.mostrarProjecao = !this.mostrarProjecao;
  }

  mudarAba(aba: 'config' | 'apostas' | 'historico') {
    this.abaAtiva = aba;
  }

  formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarPercentual(valor: number): string {
    return (valor > 0 ? '+' : '') + valor.toFixed(2) + '%';
  }

  formatarData(iso: string): string {
    const data = new Date(iso);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  contarVitorias(alavancagem: Alavancagem): number {
    return alavancagem.apostas.filter(a => a.status === 'vitoria').length;
  }

  contarDerrotas(alavancagem: Alavancagem): number {
    return alavancagem.apostas.filter(a => a.status === 'derrota').length;
  }

  formatarOddInput(event: any, index: number) {
    // função antiga (mantive caso precise)
  }

  formatarMetaPreview(): string {
    const meta = this.calcularMetaPreview();
    if (meta !== null) {
      return this.formatarMoeda(meta);
    }
    return '';
  }
  calcularMetaPreview(): number | null {
    if (
      this.saldoInicial != null && this.saldoInicial > 0 &&
      this.oddPadrao != null && this.oddPadrao > 1 &&
      this.quantidadeApostas != null && this.quantidadeApostas > 0
    ) {
      return this.saldoInicial * Math.pow(this.oddPadrao, this.quantidadeApostas);
    }
    return null;
  }

  abrirPrint(print: string) {
    this.printSelecionado = print;
  }

  fecharPrint() {
    this.printSelecionado = null;
  }

  async verPrintPorNumero(numero: number) {
    if (!this.alavancagemAtual) return;

    const index = this.alavancagemAtual.apostas.findIndex(
      a => a.numero === numero
    );

    if (index === -1) return;

    const aposta = this.alavancagemAtual.apostas[index];

    // NÃO tem print → oferecer adicionar
    if (!aposta.print) {
      const alert = await this.alertController.create({
        header: 'Print não encontrado',
        message: 'Você ainda não adicionou o print desta aposta.',
        buttons: [
          {
            text: 'Adicionar print',
            handler: () => {
              this.adicionarPrint(index);
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel'
          }
        ]
      });

      await alert.present();
      return;
    }

    // JÁ tem print → escolher ação
    const alert = await this.alertController.create({
      message: 'O que você deseja fazer?',
      buttons: [
        {
          text: 'Exibir',
          handler: () => {
            this.abrirPrint(aposta.print as string);
          }
        },
        {
          text: 'Substituir',
          handler: () => {
            this.adicionarPrint(index);
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async verPrint(index: number) {
    if (!this.alavancagemAtual) return;

    const aposta = this.alavancagemAtual.apostas[index];

    if (!aposta.print) {
      const alert = await this.alertController.create({
        message: 'Você ainda não adicionou o print desta aposta.',
        buttons: [
          {
            text: 'Adicionar print',
            handler: () => {
              this.adicionarPrint(index);
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel'
          }
        ]
      });

      await alert.present();
    } else {
      this.abrirPrint(aposta.print);
    }
  }


  // calcular meta com odd padrão
  calcularMetaOddPadrao(): number {
    if (!this.alavancagemAtual) return 0;

    const oddPadrao = parseFloat(this.alavancagemAtual.oddPadrao.toString());
    const total = this.alavancagemAtual.quantidadeApostas;

    return this.alavancagemAtual.saldoInicial * Math.pow(oddPadrao, total);
  }

  // projeção com odds reais (apostas pendentes)
  calcularProjecaoOddsReais(): number {
    if (!this.alavancagemAtual) return 0;

    let projecao = this.alavancagemAtual.saldoAtual;
    const pendentes = this.alavancagemAtual.apostas.filter(a => a.status === 'pendente');

    for (const aposta of pendentes) {
      const oddNum = parseFloat(aposta.odd.toString()) || 1.0;
      projecao *= oddNum;
    }

    return projecao;
  }

  calcularFaltaParaMeta(): number {
    const meta = this.calcularMetaOddPadrao();
    const atual = this.alavancagemAtual?.saldoAtual || 0;
    return meta - atual;
  }

  async mostrarInfoMeta() {
    const toast = await this.toastController.create({
      message: '🎯 Meta: Valor final se todas as apostas baterem com a odd padrão.',
      duration: 4000,
      position: 'middle',
      mode: 'ios',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }

  async mostrarInfoFalta() {
    const toast = await this.toastController.create({
      message: '💰 Falta ganhar: Diferença entre seu saldo atual e a meta final.',
      duration: 4000,
      position: 'middle',
      mode: 'ios',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }

  async mostrarInfoProjecao() {
    const toast = await this.toastController.create({
      message: '📊 Projeção: Valor final se todas as apostas restantes baterem com as odds reais que você colocou.',
      duration: 4000,
      position: 'middle',
      mode: 'ios',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }



  // EDITAR QUANTIDADE DE APOSTAS
  async editarQuantidadeApostas() {
    if (!this.alavancagemAtual) return;

    const current = this.alavancagemAtual.quantidadeApostas;

    const alert = await this.alertController.create({
      message: 'Quantas apostas serão ao todo?',
      inputs: [
        {
          name: 'qtd',
          type: 'number',
          value: current,
          min: 1,
          placeholder: 'Quantidade total de apostas'
        }
      ],
      buttons: [
        {
          text: 'Salvar',
          handler: async (form) => {
            const novo = parseInt(form.qtd, 10);
            if (isNaN(novo) || novo < 1) {
              this.mostrarAlerta('Erro', 'Informe uma quantidade válida (>=1).');
              return false;
            }

            if (novo === current) return true;

            if (novo > current) {
              // aumentar: adicionar apostas pendentes no final
              for (let i = current + 1; i <= novo; i++) {
                this.alavancagemAtual!.apostas.push({
                  numero: i,
                  odd: this.alavancagemAtual!.oddPadrao.toFixed(2),
                  status: 'pendente',
                  saldoAntes: 0,
                  saldoDepois: 0
                });
              }
              this.alavancagemAtual!.quantidadeApostas = novo;
              this.atualizarSaldos();
              this.salvarDados();
              return true;
            } else {
              // diminuir: verificar se removendo tiramos apostas com resultado
              const removidas = this.alavancagemAtual!.apostas.slice(novo);
              const temResultado = removidas.some(r => r.status !== 'pendente');

              if (temResultado) {
                const confirm = await this.alertController.create({
                  header: 'Atenção',
                  message: 'Existem apostas com resultado entre as que serão removidas. Deseja continuar e apagar esses resultados?',
                  buttons: [
                    { text: 'Cancelar', role: 'cancel' },
                    {
                      text: 'Apagar e Continuar',
                      handler: () => {
                        // realiza remoção
                        this.alavancagemAtual!.apostas = this.alavancagemAtual!.apostas.slice(0, novo);
                        // atualiza números
                        this.alavancagemAtual!.apostas.forEach((a, idx) => a.numero = idx + 1);
                        this.alavancagemAtual!.quantidadeApostas = novo;
                        this.atualizarSaldos();
                        this.salvarDados();
                      }
                    }
                  ]
                });
                await confirm.present();
                return false;
              } else {
                // apenas remove
                this.alavancagemAtual!.apostas = this.alavancagemAtual!.apostas.slice(0, novo);
                this.alavancagemAtual!.apostas.forEach((a, idx) => a.numero = idx + 1);
                this.alavancagemAtual!.quantidadeApostas = novo;
                this.atualizarSaldos();
                this.salvarDados();
                return true;
              }
            }
          }
        },
        { text: 'Cancelar', role: 'cancel' }
      ]
    });

    await alert.present();
  }

  get textoProjecao(): string {
    const perc = this.percentualMeta;
    if (perc > 0) return `${perc.toFixed(2)}% acima da meta`;
    if (perc < 0) return `${Math.abs(perc).toFixed(2)}% abaixo da meta`;
    return 'Na meta ideal';
  }
  get percentualMeta(): number {
    if (!this.alavancagemAtual) return 0;

    const apostasCompletas = this.alavancagemAtual.apostas.filter(a => a.status === 'vitoria').length;
    if (apostasCompletas === 0) return 0;

    const projecaoEsperada = this.alavancagemAtual.saldoInicial * Math.pow(this.alavancagemAtual.oddPadrao, apostasCompletas);

    if (projecaoEsperada === 0) return 0;

    const diferenca = ((this.alavancagemAtual.saldoAtual - projecaoEsperada) / projecaoEsperada) * 100;

    return diferenca;
  }


  async validarOddFinal(apostaNumero: number) {
    if (!this.alavancagemAtual) return;
    const idx = this.getIndexByNumero(apostaNumero);
    if (idx === -1) return;

    const aposta = this.alavancagemAtual.apostas[idx];
    const raw = (aposta.odd?.toString() ?? '').replace(',', '.');
    const num = parseFloat(raw);

    if (isNaN(num) || num <= 1.0) {
      const toast = await this.toastController.create({
        message: 'A odd deve ser maior que 1.00. Corrija antes de confirmar o resultado.',
        duration: 3000,
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    // formata corretamente
    aposta.odd = num.toFixed(2);
    this.atualizarSaldos();
    this.salvarDados();
  }

  async registrarResultado(index: number, resultado: 'vitoria' | 'derrota') {
    if (!this.alavancagemAtual) return;

    const aposta = this.alavancagemAtual.apostas[index];
    const oddNum = parseFloat((aposta.odd?.toString() ?? '').replace(',', '.'));

    // Bloqueia confirmação se odd inválida
    if (isNaN(oddNum) || oddNum <= 1.0) {
      const alert = await this.alertController.create({
        header: 'Odd inválida',
        message: 'A odd desta aposta é inválida (<= 1). Corrija a odd antes de confirmar vitória ou derrota.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Se for vitória e não tiver print, pede confirmação (mesma lógica antiga)
    if (resultado === 'vitoria' && !aposta.print) {
      const alert = await this.alertController.create({
        message: 'Deseja continuar sem adicionar o print da aposta?',
        buttons: [
          {
            text: 'Continuar',
            handler: () => {
              this.finalizarResultado(index, resultado);
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel'
          },
        ]
      });
      await alert.present();
    } else {
      this.finalizarResultado(index, resultado);
    }
  }
  
}