/* TaxMitra — Shared Calculator Logic (Income Tax + GST + EMI) */
(function (global) {
  // ===== Income Tax Engine (FY 2025-26 & 2026-27) =====
  const NEW_SLABS = [
    [400000, 0], [400000, 0.05], [400000, 0.1], [400000, 0.15],
    [400000, 0.2], [400000, 0.25], [Infinity, 0.3]
  ];
  const FY_META = {
    '2025-26': { label: 'FY 2025-26 (AY 2026-27)', ay: '2026-27' },
    '2026-27': { label: 'FY 2026-27 (AY 2027-28)', ay: '2027-28' }
  };

  function oldSlabs(age) {
    if (age === '80+') return [[500000, 0], [500000, 0.2], [Infinity, 0.3]];
    if (age === '60-80') return [[300000, 0], [200000, 0.05], [500000, 0.2], [Infinity, 0.3]];
    return [[250000, 0], [250000, 0.05], [500000, 0.2], [Infinity, 0.3]];
  }

  function slabTax(taxable, slabs) {
    let tax = 0, rem = Math.max(0, taxable), rows = [];
    for (let i = 0; i < slabs.length; i++) {
      const [width, rate] = slabs[i];
      if (rem <= 0) break;
      const chunk = width === Infinity ? rem : Math.min(rem, width);
      const t = chunk * rate;
      tax += t;
      if (chunk > 0) rows.push({ slab: i + 1, amount: chunk, rate: rate * 100, tax: t });
      rem -= chunk;
    }
    return { tax, rows };
  }

  function surcharge(tax, taxable, isNew) {
    if (taxable <= 5000000 || tax <= 0) return { amount: 0, rate: 0 };
    let rate = 0;
    if (taxable <= 10000000) rate = 0.1;
    else if (taxable <= 20000000) rate = 0.15;
    else if (taxable <= 50000000) rate = 0.25;
    else rate = isNew ? 0.25 : 0.37;
    return { amount: tax * rate, rate: rate * 100 };
  }

  function rebate87A(tax, taxable, regime) {
    if (tax <= 0) return 0;
    if (regime === 'new' && taxable <= 1200000) return Math.min(tax, 60000);
    if (regime === 'old' && taxable <= 500000) return Math.min(tax, 12500);
    return 0;
  }

  function num(id) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || 0 : 0;
  }

  function readInputs() {
    return {
      fy: document.getElementById('tax-fy')?.value || '2025-26',
      age: document.getElementById('tax-age')?.value || '0-60',
      salary: num('tax-salary'),
      exemptAllowances: num('tax-exempt'),
      otherIncome: num('tax-other'),
      interestIncome: num('tax-interest'),
      rentalIncome: num('tax-rental'),
      businessIncome: num('tax-business'),
      capitalGains: num('tax-capital'),
      ded80c: num('tax-80c'),
      ded80d: num('tax-80d'),
      ded80g: num('tax-80g'),
      ded80e: num('tax-80e'),
      ded80tta: num('tax-80tta'),
      hraExempt: num('tax-hra'),
      homeLoanSelf: num('tax-hl-self'),
      homeLoanLet: num('tax-hl-let'),
      profTax: num('tax-prof'),
      npsEmployee: num('tax-nps-emp')
    };
  }

  function computeRegime(inputs, regime) {
    const isNew = regime === 'new';
    const stdDed = isNew ? 75000 : 50000;
    let salaryTaxable = Math.max(0, inputs.salary - inputs.exemptAllowances - stdDed);
    if (!isNew) salaryTaxable = Math.max(0, inputs.salary - inputs.exemptAllowances - inputs.hraExempt - stdDed);
    const gross = salaryTaxable + inputs.otherIncome + inputs.interestIncome +
      inputs.rentalIncome + inputs.businessIncome + inputs.capitalGains;
    let deductions = 0;
    if (!isNew) {
      const cap80c = Math.min(inputs.ded80c, 150000);
      const cap80tta = Math.min(inputs.ded80tta, Math.min(inputs.interestIncome, 10000));
      const capHL = Math.min(inputs.homeLoanSelf, 200000) + Math.min(inputs.homeLoanLet, 200000);
      deductions = cap80c + inputs.ded80d + inputs.ded80g + inputs.ded80e +
        cap80tta + capHL + inputs.profTax + Math.min(inputs.npsEmployee, 50000);
    }
    const taxable = Math.max(0, gross - deductions);
    const slabs = isNew ? NEW_SLABS : oldSlabs(inputs.age);
    const { tax: baseTax, rows } = slabTax(taxable, slabs);
    const reb = rebate87A(baseTax, taxable, regime);
    const taxAfterRebate = Math.max(0, baseTax - reb);
    const sur = surcharge(taxAfterRebate, taxable, isNew);
    const cess = (taxAfterRebate + sur.amount) * 0.04;
    const total = taxAfterRebate + sur.amount + cess;
    return { taxable, baseTax, rebate: reb, surcharge: sur.amount, cess, total, rows };
  }

  function fmt(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function renderBreakdown(id, d) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!d.rows.length) {
      el.innerHTML = '<p style="color:var(--gray);font-size:.88rem">No taxable income.</p>';
      return;
    }
    let h = '<table class="slab-table"><thead><tr><th>Slab</th><th>Amount</th><th>Rate</th><th>Tax</th></tr></thead><tbody>';
    d.rows.forEach((r) => {
      h += `<tr><td>${r.slab}</td><td>${fmt(r.amount)}</td><td>${r.rate}%</td><td>${fmt(r.tax)}</td></tr>`;
    });
    el.innerHTML = h + '</tbody></table>';
  }

  function renderSummary(prefix, d) {
    const m = {
      taxable: d.taxable, basetax: d.baseTax, rebate: d.rebate,
      surcharge: d.surcharge, cess: d.cess, total: d.total
    };
    Object.keys(m).forEach((k) => {
      const n = document.getElementById(prefix + '-' + k);
      if (n) n.textContent = fmt(m[k]);
    });
  }

  function highlightWinner() {
    const oldT = parseFloat((document.getElementById('tax-old-total-big')?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    const newT = parseFloat((document.getElementById('tax-new-total-big')?.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    const oldC = document.getElementById('old-regime-card');
    const newC = document.getElementById('new-regime-card');
    if (oldC) oldC.classList.toggle('winner', oldT < newT && oldT > 0);
    if (newC) newC.classList.toggle('winner', newT < oldT || (oldT === 0 && newT === 0));
  }

  function calculateDetailedTax() {
    const inputs = readInputs();
    const oldR = computeRegime(inputs, 'old');
    const newR = computeRegime(inputs, 'new');
    const savings = oldR.total - newR.total;
    const better = savings >= 0 ? 'new' : 'old';
    renderSummary('old', oldR);
    renderSummary('new', newR);
    renderBreakdown('old-slab-breakdown', oldR);
    renderBreakdown('new-slab-breakdown', newR);
    const saveEl = document.getElementById('tax-savings');
    const recEl = document.getElementById('tax-recommend');
    const cmpEl = document.getElementById('tax-compare-wrap');
    if (saveEl) saveEl.textContent = fmt(Math.abs(savings));
    if (recEl) {
      recEl.textContent = better === 'new'
        ? '✓ New Tax Regime is more beneficial for your inputs'
        : '✓ Old Tax Regime is more beneficial for your inputs';
      recEl.className = 'tax-recommend ' + better;
    }
    if (cmpEl) cmpEl.classList.add('show');
    const oldBig = document.getElementById('tax-old-total-big');
    const newBig = document.getElementById('tax-new-total-big');
    if (oldBig) oldBig.textContent = fmt(oldR.total);
    if (newBig) newBig.textContent = fmt(newR.total);
    const meta = document.getElementById('tax-result-meta');
    if (meta) meta.textContent = 'Computed for ' + (FY_META[inputs.fy]?.label || inputs.fy) + ' · Age: ' + inputs.age;
    highlightWinner();
  }

  // ===== GST Calculator =====
  function calcGST() {
    const a = parseFloat(document.getElementById('gst-amount').value) || 0;
    const r = parseFloat(document.getElementById('gst-rate').value) || 0;
    const t = document.getElementById('gst-type').value;
    let base, gst, total;
    if (t === 'inclusive') {
      total = a;
      base = (a * 100) / (100 + r);
      gst = a - base;
    } else {
      base = a;
      gst = (a * r) / 100;
      total = a + gst;
    }
    const f = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
    document.getElementById('gr-base').textContent = f(base);
    document.getElementById('gr-cgst').textContent = f(gst / 2);
    document.getElementById('gr-sgst').textContent = f(gst / 2);
    document.getElementById('gr-total').textContent = f(total);
    document.getElementById('gst-result').classList.add('show');
  }

  // ===== EMI Calculator =====
  function calcEMI() {
    const p = parseFloat(document.getElementById('emi-principal').value) || 0;
    const r = (parseFloat(document.getElementById('emi-rate').value) || 0) / 12 / 100;
    const n = parseFloat(document.getElementById('emi-tenure').value) || 0;
    if (!p || !r || !n) return;
    const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    const interest = total - p;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    document.getElementById('er-emi').textContent = f(emi);
    document.getElementById('er-interest').textContent = f(interest);
    document.getElementById('er-total').textContent = f(total);
    document.getElementById('emi-result').classList.add('show');
  }

  // ===== SIP Calculator =====
  // FV of SIP = P * [((1+r)^n - 1) / r] * (1+r) where r is monthly rate, n is months
  function calcSIP() {
    const P = parseFloat(document.getElementById('sip-amount').value) || 0;
    const annual = parseFloat(document.getElementById('sip-return').value) || 0;
    const years = parseFloat(document.getElementById('sip-years').value) || 0;
    if (!P || !annual || !years) return;
    const r = annual / 12 / 100;
    const n = years * 12;
    const fv = P * (((Math.pow(1 + r, n) - 1) / r)) * (1 + r);
    const invested = P * n;
    const returns = fv - invested;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    document.getElementById('sip-invested').textContent = f(invested);
    document.getElementById('sip-returns').textContent = f(returns);
    document.getElementById('sip-fv').textContent = f(fv);
    document.getElementById('sip-result').classList.add('show');
  }

  // ===== PPF Calculator =====
  // Annual contribution compounded annually for n years
  // FV = P * [((1+r)^n - 1) / r] * (1+r) - annuity-due variant
  function calcPPF() {
    const P = parseFloat(document.getElementById('ppf-amount').value) || 0;
    const annual = parseFloat(document.getElementById('ppf-rate').value) || 0;
    const years = parseFloat(document.getElementById('ppf-years').value) || 0;
    if (!P || !annual || !years) return;
    const r = annual / 100;
    const fv = P * (((Math.pow(1 + r, years) - 1) / r)) * (1 + r);
    const invested = P * years;
    const interest = fv - invested;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    document.getElementById('ppf-invested').textContent = f(invested);
    document.getElementById('ppf-interest').textContent = f(interest);
    document.getElementById('ppf-maturity').textContent = f(fv);
    document.getElementById('ppf-result').classList.add('show');
  }

  // ===== HRA Calculator =====
  // Per Section 10(13A): HRA exempt = LEAST of
  //   (1) actual HRA received
  //   (2) rent paid − 10% of (Basic + DA)
  //   (3) 50% of (Basic + DA) for metros / 40% for non-metros
  function calcHRA() {
    const basicM = parseFloat(document.getElementById('hra-basic').value) || 0;
    const daM = parseFloat(document.getElementById('hra-da').value) || 0;
    const hraM = parseFloat(document.getElementById('hra-received').value) || 0;
    const rentM = parseFloat(document.getElementById('hra-rent').value) || 0;
    const cityEl = document.getElementById('hra-city');
    const city = cityEl ? cityEl.value : 'metro';

    const basicAnnual = (basicM + daM) * 12;
    const actualHRA = hraM * 12;
    const rentMinus10 = Math.max(0, rentM * 12 - 0.1 * basicAnnual);
    const pctOfBasic = (city === 'metro' ? 0.5 : 0.4) * basicAnnual;

    // The exemption only applies if actually receiving HRA + paying rent
    const eligible = actualHRA > 0 && rentM > 0;
    const exempt = eligible ? Math.max(0, Math.min(actualHRA, rentMinus10, pctOfBasic)) : 0;
    const taxable = Math.max(0, actualHRA - exempt);

    // Which condition is binding (the smallest of the three)?
    let binding = '—';
    if (eligible) {
      const min = Math.min(actualHRA, rentMinus10, pctOfBasic);
      if (min === actualHRA) binding = 'Actual HRA received';
      else if (min === rentMinus10) binding = 'Rent − 10% of (Basic + DA)';
      else binding = (city === 'metro' ? '50% of (Basic + DA) — metro' : '40% of (Basic + DA) — non-metro');
    }

    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('hra-actual', f(actualHRA));
    set('hra-rent-minus', f(rentMinus10));
    set('hra-pct-basic', f(pctOfBasic));
    set('hra-exempt', f(exempt));
    set('hra-taxable', f(taxable));
    set('hra-exempt-monthly', f(exempt / 12));
    set('hra-binding', binding);

    // Mark winning row
    ['row-actual', 'row-rent', 'row-pct'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('winner');
    });
    if (eligible) {
      const min = Math.min(actualHRA, rentMinus10, pctOfBasic);
      if (min === actualHRA) document.getElementById('row-actual')?.classList.add('winner');
      else if (min === rentMinus10) document.getElementById('row-rent')?.classList.add('winner');
      else document.getElementById('row-pct')?.classList.add('winner');
    }

    const res = document.getElementById('hra-result');
    if (res) res.classList.add('show');
  }

  // ===== NPS Calculator =====
  // Accumulation via SIP-like formula; at retirement 60% lump-sum (tax-free), 40% min annuity
  function calcNPS() {
    const age = parseFloat(document.getElementById('nps-age').value) || 0;
    const retAge = parseFloat(document.getElementById('nps-ret-age').value) || 60;
    const monthly = parseFloat(document.getElementById('nps-monthly').value) || 0;
    const ret = parseFloat(document.getElementById('nps-return').value) || 0;
    const annPct = parseFloat(document.getElementById('nps-annuity-pct').value) || 40;
    const annRate = parseFloat(document.getElementById('nps-annuity-rate').value) || 6;
    if (!age || !monthly || age >= retAge) return;
    const months = (retAge - age) * 12;
    const r = ret / 12 / 100;
    const corpus = monthly * (((Math.pow(1 + r, months) - 1) / r)) * (1 + r);
    const invested = monthly * months;
    const annuityCorpus = corpus * (annPct / 100);
    const lumpSum = corpus - annuityCorpus;
    const monthlyPension = (annuityCorpus * annRate / 100) / 12;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    document.getElementById('nps-invested').textContent = f(invested);
    document.getElementById('nps-corpus').textContent = f(corpus);
    document.getElementById('nps-lump').textContent = f(lumpSum);
    document.getElementById('nps-pension').textContent = f(monthlyPension);
    document.getElementById('nps-result').classList.add('show');
  }

  // ===== FD Calculator =====
  // A = P (1 + r/n)^(nt) — compounds quarterly by default
  function calcFD() {
    const P = parseFloat(document.getElementById('fd-amount').value) || 0;
    const r = parseFloat(document.getElementById('fd-rate').value) || 0;
    const t = parseFloat(document.getElementById('fd-years').value) || 0;
    const n = parseFloat(document.getElementById('fd-compounding').value) || 4;
    if (!P || !r || !t) return;
    const amount = P * Math.pow(1 + r / (n * 100), n * t);
    const interest = amount - P;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    document.getElementById('fd-principal').textContent = f(P);
    document.getElementById('fd-interest').textContent = f(interest);
    document.getElementById('fd-maturity').textContent = f(amount);
    document.getElementById('fd-result').classList.add('show');
  }

  // ===== Compound Interest Calculator =====
  // A = P (1 + r/n)^(nt)
  function calcCI() {
    const P = parseFloat(document.getElementById('ci-principal').value) || 0;
    const r = parseFloat(document.getElementById('ci-rate').value) || 0;
    const t = parseFloat(document.getElementById('ci-years').value) || 0;
    const n = parseFloat(document.getElementById('ci-frequency').value) || 1;
    const A = P * Math.pow(1 + r / (n * 100), n * t);
    const interest = A - P;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ci-final', f(A));
    set('ci-interest', f(interest));
    set('ci-principal-out', f(P));
    const res = document.getElementById('ci-result');
    if (res) res.classList.add('show');
  }

  // ===== Home Loan EMI Calculator (variant of EMI with tax-benefit summary) =====
  function calcHomeLoan() {
    const P = parseFloat(document.getElementById('hl-principal').value) || 0;
    const rAnn = parseFloat(document.getElementById('hl-rate').value) || 0;
    const years = parseFloat(document.getElementById('hl-years').value) || 0;
    const r = rAnn / 12 / 100;
    const n = years * 12;
    if (!P || !rAnn || !years) return;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    const interest = total - P;
    // Year-1 approximate split (interest-heavy in early years)
    const year1Interest = Math.min(interest, P * (rAnn / 100));
    const taxBenefit80C = Math.min(P / years, 150000); // approx principal in year 1, capped
    const taxBenefit24 = Math.min(year1Interest, 200000);
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('hl-emi', f(emi));
    set('hl-interest', f(interest));
    set('hl-total', f(total));
    set('hl-tax-24', f(taxBenefit24));
    set('hl-tax-80c', f(taxBenefit80C));
    const res = document.getElementById('hl-result');
    if (res) res.classList.add('show');
  }

  // ===== Salary Calculator (CTC -> In-hand) =====
  // Simplified model:
  //   Basic = 50% of CTC
  //   HRA = 50%/40% of Basic
  //   Special allowance = remainder
  //   Employer PF = 12% of Basic (capped at ₹21,600/year for many; we cap at min(Basic*12%, 21600))
  //   Employee PF = 12% of Basic (capped same)
  //   Gratuity (in CTC) = 4.81% of Basic
  //   Gross = CTC - Employer PF - Gratuity
  //   Net = Gross - Employee PF - Prof Tax (₹2,400/yr) - estimated tax
  function calcSalary() {
    const ctc = parseFloat(document.getElementById('sal-ctc').value) || 0;
    const city = document.getElementById('sal-city')?.value || 'metro';
    const regime = document.getElementById('sal-regime')?.value || 'new';
    if (!ctc) return;

    const basic = 0.5 * ctc;
    const hra = (city === 'metro' ? 0.5 : 0.4) * basic;
    const employerPF = Math.min(basic * 0.12, 21600);
    const gratuity = 0.0481 * basic;
    const special = Math.max(0, ctc - basic - hra - employerPF - gratuity);
    const gross = ctc - employerPF - gratuity;
    const employeePF = Math.min(basic * 0.12, 21600);
    const profTax = 2400;

    // Rough tax estimate based on regime
    let taxable = 0;
    let tax = 0;
    if (regime === 'new') {
      taxable = Math.max(0, gross - 75000);
      const slabs = [[400000, 0], [400000, 0.05], [400000, 0.1], [400000, 0.15], [400000, 0.2], [400000, 0.25], [Infinity, 0.3]];
      let rem = taxable;
      for (const [w, r] of slabs) {
        if (rem <= 0) break;
        const chunk = w === Infinity ? rem : Math.min(rem, w);
        tax += chunk * r;
        rem -= chunk;
      }
      if (taxable <= 1200000) tax = Math.max(0, tax - 60000);
    } else {
      taxable = Math.max(0, gross - 50000 - hra * 0.7 - 150000 - employeePF);
      const slabs = [[250000, 0], [250000, 0.05], [500000, 0.2], [Infinity, 0.3]];
      let rem = taxable;
      for (const [w, r] of slabs) {
        if (rem <= 0) break;
        const chunk = w === Infinity ? rem : Math.min(rem, w);
        tax += chunk * r;
        rem -= chunk;
      }
      if (taxable <= 500000) tax = Math.max(0, tax - 12500);
    }
    const cess = tax * 0.04;
    const totalTax = tax + cess;

    const netAnnual = gross - employeePF - profTax - totalTax;
    const netMonthly = netAnnual / 12;

    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sal-basic', f(basic));
    set('sal-hra', f(hra));
    set('sal-special', f(special));
    set('sal-emp-pf', f(employerPF));
    set('sal-gratuity', f(gratuity));
    set('sal-gross', f(gross));
    set('sal-employee-pf', f(employeePF));
    set('sal-prof-tax', f(profTax));
    set('sal-tax', f(totalTax));
    set('sal-net-annual', f(netAnnual));
    set('sal-net-monthly', f(netMonthly));
    const res = document.getElementById('sal-result');
    if (res) res.classList.add('show');
  }

  // ===== EPF Calculator =====
  // Year-by-year simulation with annual increment + 8.25% interest on running balance
  function calcEPF() {
    const age = parseFloat(document.getElementById('epf-age').value) || 0;
    const retAge = parseFloat(document.getElementById('epf-ret-age').value) || 58;
    const basicM = parseFloat(document.getElementById('epf-basic').value) || 0;
    const balance = parseFloat(document.getElementById('epf-balance').value) || 0;
    const inc = (parseFloat(document.getElementById('epf-increment').value) || 0) / 100;
    const rate = (parseFloat(document.getElementById('epf-rate').value) || 8.25) / 100;
    if (!age || !basicM || age >= retAge) return;

    const years = retAge - age;
    let corpus = balance;
    let totalEmployee = 0;
    let totalEmployerEPF = 0;
    let monthlyBasic = basicM;

    for (let y = 0; y < years; y++) {
      const annualBasic = monthlyBasic * 12;
      const empContrib = annualBasic * 0.12;
      // Employer PF portion: 3.67% of basic (rest goes to EPS, not in EPF balance)
      // For simplicity, use full 12% as combined corpus growth
      const employerContrib = annualBasic * 0.0367;
      totalEmployee += empContrib;
      totalEmployerEPF += employerContrib;
      corpus = (corpus + empContrib + employerContrib) * (1 + rate);
      monthlyBasic *= (1 + inc);
    }

    const totalInterest = corpus - totalEmployee - totalEmployerEPF - balance;
    const f = (x) => '₹' + Math.round(x).toLocaleString('en-IN');
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('epf-corpus', f(corpus));
    set('epf-total-employee', f(totalEmployee));
    set('epf-total-employer', f(totalEmployerEPF));
    set('epf-total-interest', f(totalInterest));
    const res = document.getElementById('epf-result');
    if (res) res.classList.add('show');
  }

  global.TaxMitraCalc = {
    calculateDetailedTax,
    calcGST,
    calcEMI,
    calcSIP,
    calcPPF,
    calcHRA,
    calcNPS,
    calcFD,
    calcCI,
    calcHomeLoan,
    calcSalary,
    calcEPF,
    FY_META
  };
})(window);
