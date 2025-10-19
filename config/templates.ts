import { Template } from '../types';

export const etpTemplates: Template[] = [
  {
    id: 'etp-ti-equipment',
    name: 'Aquisição de Equipamentos de TI',
    description: 'Template para compra de computadores, notebooks, servidores ou outros equipamentos de informática.',
    type: 'etp',
    sections: {
      'etp-1-introducao': 'Este Estudo Técnico Preliminar (ETP) tem como objetivo planejar e fundamentar a aquisição de novos equipamentos de tecnologia da informação para modernizar o parque tecnológico desta instituição, visando aumentar a produtividade e a segurança da informação.',
      'etp-2-necessidade': 'A demanda atual surge da obsolescência dos equipamentos em uso, que possuem em média mais de 5 anos de utilização. Isso resulta em lentidão, falhas constantes, incompatibilidade com softwares modernos e riscos de segurança, afetando diretamente a performance dos colaboradores e a continuidade dos serviços.',
      'etp-3-requisitos': 'Os equipamentos devem possuir, no mínimo: processador de última geração, 16GB de memória RAM, 512GB de armazenamento em SSD, e garantia on-site de 3 anos. Devem ser compatíveis com o sistema operacional Windows 11 Pro e possuir certificações ambientais, como EPEAT Gold.',
      'etp-4-mercado': 'Foram consideradas as seguintes soluções:\n1.  **Aquisição de Desktops:** Compra de computadores de mesa tradicionais.\n2.  **Aquisição de Notebooks:** Compra de computadores portáteis.\n3.  **Locação de Equipamentos (HaaS):** Contratação de uma empresa que fornece e mantém os equipamentos.\nA análise comparativa demonstrou que a aquisição de notebooks (Solução 2) apresenta o melhor custo-benefício, oferecendo a mobilidade necessária para o modelo de trabalho híbrido adotado pela instituição.',
      'etp-5-solucao': 'A solução consiste na aquisição de 100 notebooks corporativos. O ciclo de vida do objeto é estimado em 5 anos. A garantia e a assistência técnica on-site por 36 meses são requisitos indispensáveis para garantir a continuidade das operações com o mínimo de interrupção.',
      'etp-6-estimativas': 'A quantidade de 100 notebooks foi estimada com base no levantamento realizado pelo Departamento de TI, que identificou 80 equipamentos a serem substituídos por obsolescência e uma necessidade de 20 novos equipamentos para novos servidores aprovados em concurso.',
      'etp-7-valor': 'A estimativa de valor foi realizada com base em pesquisa no Painel de Preços do Governo Federal, em contratações similares de outros órgãos públicos e em cotações diretas com 3 fornecedores. O valor estimado total é de R$ 500.000,00, com um preço unitário de R$ 5.000,00 por notebook.',
      'etp-8-parcelamento': 'A contratação não será parcelada. A aquisição em lote único de 100 unidades visa obter economia de escala, garantir a padronização dos equipamentos e simplificar a gestão contratual e logística de entrega.',
      'etp-9-correlatas': 'Esta contratação é interdependente da contratação de licenças de software de produtividade e antivírus, que serão objeto de licitação específica, mas devem ocorrer em cronograma alinhado.',
      'etp-10-alinhamento': 'A presente contratação está prevista no Plano de Contratações Anual (PCA) desta instituição para o exercício de 2024, sob o item nº 33.90.30 - Material de Consumo.',
      'etp-11-resultados': 'Espera-se obter um aumento de 25% na produtividade dos servidores com os novos equipamentos, redução de 80% nos chamados de suporte técnico relacionados a hardware e garantir a segurança dos dados institucionais com equipamentos modernos e atualizados.',
      'etp-12-providencias': 'Antes da celebração do contrato, o setor de TI deverá preparar a imagem padrão do sistema operacional e os scripts de configuração para agilizar a implantação dos novos equipamentos. O Almoxarifado deverá reservar espaço para o recebimento e conferência dos 100 volumes.',
      'etp-13-sustentabilidade': 'Será exigido que os equipamentos possuam certificação EPEAT Gold, garantindo baixo consumo de energia e uso de materiais reciclados. A contratada deverá apresentar um plano para a logística reversa e descarte ambientalmente adequado das embalagens.',
      'etp-14-viabilidade': 'Diante do exposto, conclui-se pela viabilidade e necessidade da presente contratação, por ser a solução mais adequada e vantajosa para suprir a demanda da Administração, alinhada aos princípios da eficiência e da economicidade.',
    },
  },
];

export const trTemplates: Template[] = [
  {
    id: 'tr-notebooks',
    name: 'Aquisição de Notebooks',
    description: 'Modelo detalhado para a compra de computadores portáteis para uso institucional.',
    type: 'tr',
    sections: {
      'tr-1-objeto': 'Aquisição de 100 (cem) notebooks, conforme especificações técnicas, condições e prazos estabelecidos neste Termo de Referência e seus anexos. O prazo de garantia mínimo exigido é de 36 (trinta e seis) meses on-site.',
      'tr-2-justificativa': 'A presente contratação justifica-se pela necessidade de modernização do parque computacional, em substituição a equipamentos obsoletos e com baixo desempenho, conforme detalhado no Estudo Técnico Preliminar nº XXX/2024. A aquisição visa prover aos servidores ferramentas de trabalho adequadas, promovendo maior agilidade, mobilidade e segurança no desempenho de suas atividades.',
      'tr-3-natureza': 'O objeto é classificado como bem comum de tecnologia da informação e comunicação, a ser adquirido por fornecimento único.',
      'tr-4-execucao-requisitos': 'Os equipamentos deverão ser novos, de primeiro uso, e entregues em suas embalagens originais lacradas. As especificações técnicas mínimas estão detalhadas no Anexo I. A contratada deverá realizar a entrega no local indicado e prestar a garantia técnica on-site, com substituição de peças e mão de obra inclusas.',
      'tr-5-prazo-execucao': 'A entrega dos 100 notebooks deverá ser realizada em parcela única, no prazo máximo de 45 (quarenta e cinco) dias corridos, contados a partir do recebimento da Nota de Empenho ou assinatura do contrato.',
      'tr-6-prazo-vigencia': 'O contrato terá vigência de 12 (doze) meses a contar de sua assinatura, para fins de recebimento e pagamento. A garantia técnica dos equipamentos será de 36 (trinta e seis) meses, independente da vigência contratual.',
      'tr-7-garantia': 'Será exigida garantia de execução contratual no percentual de 5% (cinco por cento) sobre o valor total do contrato, em uma das modalidades previstas no art. 96 da Lei nº 14.133/21.',
      'tr-8-obrigacoes': '**Obrigações da CONTRATADA:**\n- Entregar os equipamentos em perfeito estado de funcionamento e em conformidade com as especificações.\n- Prestar a garantia técnica on-site de 36 meses.\n\n**Obrigações da CONTRATANTE:**\n- Efetuar o pagamento no prazo e condições estabelecidas.\n- Realizar o recebimento dos bens.',
      'tr-9-selecao-fornecedor': 'A seleção do fornecedor será realizada por meio de licitação na modalidade Pregão, em sua forma eletrônica, com critério de julgamento de Menor Preço por item.',
      'tr-10-qualificacao': 'A licitante deverá apresentar Atestado de Capacidade Técnica que comprove o fornecimento de bens similares. Deverá comprovar regularidade fiscal, social e trabalhista, e apresentar balanço patrimonial que demonstre boa situação financeira.',
      'tr-11-subcontratacao': 'Não será permitida a subcontratação do objeto principal desta contratação, que é o fornecimento dos equipamentos.',
      'tr-12-gestao-contrato': 'A gestão e fiscalização do contrato serão realizadas por servidor(a) ou comissão designada pela área de Tecnologia da Informação, que será responsável por acompanhar a entrega, atestar o recebimento técnico e acionar a garantia, se necessário.',
      'tr-13-medicao-pagamento': 'O pagamento será efetuado em parcela única, no prazo de até 30 (trinta) dias após o recebimento definitivo dos equipamentos, mediante a apresentação da correspondente nota fiscal devidamente atestada pelo fiscal do contrato.',
      'tr-14-sancoes': 'O descumprimento total ou parcial das obrigações assumidas sujeitará a contratada às sanções previstas no Capítulo II do Título IV da Lei nº 14.133/2021.',
      'tr-15-sustentabilidade': 'Os equipamentos deverão possuir certificação EPEAT Gold ou similar, e a contratada deverá apresentar plano para a logística reversa das embalagens.',
      'tr-16-orcamento': 'A despesa correrá à conta da dotação orçamentária: Programa de Trabalho nº XXXXX, Natureza da Despesa nº XXXXX, Fonte de Recursos nº XXXXX.',
      'tr-17-anexos': 'Anexo I - Especificações Técnicas Mínimas dos Notebooks.\nAnexo II - Estudo Técnico Preliminar nº XXX/2024.\nAnexo III - Minuta do Contrato.',
    },
  },
];
