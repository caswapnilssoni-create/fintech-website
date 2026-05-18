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

  global.TaxMitraCalc = {
    calculateDetailedTax,
    calcGST,
    calcEMI,
    FY_META
  };
})(window);
