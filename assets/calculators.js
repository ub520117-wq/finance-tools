
      (function(){
        "use strict";
        var currency = "PKR";
        var fmtCache = {};
        function fmt(n){
          if (!isFinite(n)) return "—";
          if (!fmtCache[currency]) {
            try { fmtCache[currency] = new Intl.NumberFormat("en-US",{style:"currency",currency:currency,maximumFractionDigits:0}); }
            catch(e){ fmtCache[currency] = new Intl.NumberFormat("en-US",{maximumFractionDigits:0}); }
          }
          return fmtCache[currency].format(Math.round(n));
        }
        function fmtNum(n){
          if (!isFinite(n)) return "—";
          return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(n));
        }
        function fmtShort(n){
          if (!isFinite(n)) return "—";
          var abs = Math.abs(n);
          if (abs >= 1e7) return (n/1e7).toFixed(2).replace(/\.?0+$/,"") + " Cr";
          if (abs >= 1e5) return (n/1e5).toFixed(2).replace(/\.?0+$/,"") + " L";
          if (abs >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,"") + "k";
          return String(Math.round(n));
        }
        function num(id){ var el = document.getElementById(id); if (!el) return 0; var v = parseFloat(el.value); return isFinite(v) ? v : 0; }
        function setText(id, txt){ var el = document.getElementById(id); if (el) el.textContent = txt; }
        function monthsText(m){
          if (!isFinite(m)) return "—";
          var y = Math.floor(m/12), r = m % 12;
          var parts = [];
          if (y > 0) parts.push(y + (y === 1 ? " year" : " years"));
          if (r > 0 || y === 0) parts.push(r + (r === 1 ? " month" : " months"));
          return parts.join(", ");
        }
        function emiFormula(P, annualRate, n){
          var r = annualRate / 1200;
          if (n <= 0) return 0;
          if (r === 0) return P / n;
          var f = Math.pow(1 + r, n);
          return P * r * f / (f - 1);
        }
        /* Bind a range slider and a number input together */
        function bind(pair, onChange){
          var range = document.getElementById(pair[0]), box = document.getElementById(pair[1]);
          if (!range || !box) return;
          range.addEventListener("input", function(){ box.value = range.value; onChange(); });
          box.addEventListener("input", function(){
            var v = parseFloat(box.value);
            if (isFinite(v)) { range.value = v; }
            onChange();
          });
        }

        /* ---------------- Tabs ---------------- */
        var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
        function showTab(name){
          tabs.forEach(function(t){
            var active = t.getAttribute("data-tab") === name;
            t.setAttribute("aria-selected", active ? "true" : "false");
            var p = document.getElementById("panel-" + t.getAttribute("data-tab")); if (p) p.hidden = !active;
          });
        }
        tabs.forEach(function(t){
          t.addEventListener("click", function(){ showTab(t.getAttribute("data-tab")); });
        });
        Array.prototype.forEach.call(document.querySelectorAll("[data-jump]"), function(a){
          a.addEventListener("click", function(){ showTab(a.getAttribute("data-jump")); });
        });

        /* ---------------- EMI ---------------- */
        function calcEmi(){
          var P = Math.max(0, num("emiAmountNum"));
          var rate = Math.max(0, num("emiRateNum"));
          var years = Math.max(0, num("emiYearsNum"));
          var n = Math.round(years * 12);
          var e = emiFormula(P, rate, n);
          var total = e * n, interest = total - P;
          setText("emiMonthly", fmt(e));
          setText("emiPrincipalOut", fmt(P));
          setText("emiInterestOut", fmt(Math.max(0, interest)));
          setText("emiTotalOut", fmt(total));
          setText("emiCountOut", n + " monthly payments");
          /* donut */
          var svg = document.getElementById("emiDonut");
          if (!svg) return;
          var C = 2 * Math.PI * 80, frac = total > 0 ? P / total : 0;
          var pLen = C * frac;
          svg.setAttribute("viewBox", "0 0 200 200");
          svg.innerHTML =
            '<circle cx="100" cy="100" r="80" fill="none" stroke="var(--chart-b)" stroke-width="30"></circle>' +
            '<circle cx="100" cy="100" r="80" fill="none" stroke="var(--accent)" stroke-width="30" ' +
              'stroke-dasharray="' + pLen.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 100 100)"></circle>' +
            '<text x="100" y="96" text-anchor="middle" font-size="13" fill="var(--muted)">Interest</text>' +
            '<text x="100" y="124" text-anchor="middle" font-size="26" font-weight="600" fill="var(--ink)">' +
              (total > 0 ? Math.round((1 - frac) * 100) : 0) + '%</text>';
        }
        bind(["emiAmount","emiAmountNum"], calcEmi);
        bind(["emiRate","emiRateNum"], calcEmi);
        bind(["emiYears","emiYearsNum"], calcEmi);

        /* ---------------- Loan / amortization ---------------- */
        function amortize(P, annualRate, n, extra){
          var r = annualRate / 1200;
          var e = emiFormula(P, annualRate, n);
          var pay = e + Math.max(0, extra);
          var bal = P, totalInt = 0, months = 0, rows = [];
          var yPrin = 0, yInt = 0;
          while (bal > 0.005 && months < 1200) {
            var interest = bal * r;
            var principal = pay - interest;
            if (principal <= 0) { months = Infinity; break; }
            if (principal > bal) { principal = bal; }
            bal -= principal; totalInt += interest; months++;
            yPrin += principal; yInt += interest;
            if (months % 12 === 0 || bal <= 0.005) {
              rows.push({ year: Math.ceil(months / 12), prin: yPrin, intr: yInt, bal: Math.max(0, bal) });
              yPrin = 0; yInt = 0;
            }
          }
          return { emi: e, months: months, totalInt: totalInt, rows: rows };
        }
        function calcLoan(){
          var P = Math.max(0, num("loanAmountNum"));
          var rate = Math.max(0, num("loanRateNum"));
          var n = Math.round(Math.max(0, num("loanYearsNum")) * 12);
          var extra = Math.max(0, num("loanExtraNum"));
          var base = amortize(P, rate, n, 0);
          var withX = amortize(P, rate, n, extra);
          setText("loanEmiOut", fmt(base.emi));
          setText("loanSaved", fmt(Math.max(0, base.totalInt - withX.totalInt)));
          setText("loanPayoffOut", isFinite(withX.months) ? monthsText(withX.months) : "Never — payment too low");
          var savedM = base.months - withX.months;
          setText("loanTimeSavedOut", isFinite(savedM) && savedM > 0 ? monthsText(savedM) : "—");
          setText("loanInterestOut", fmt(withX.totalInt));
          setText("loanInterestBaseOut", fmt(base.totalInt));
          var body = document.getElementById("loanScheduleBody");
          if (!body) return;
          var html = "";
          withX.rows.forEach(function(row){
            html += "<tr><td>" + row.year + "</td><td>" + fmtNum(row.prin) + "</td><td>" + fmtNum(row.intr) + "</td><td>" + fmtNum(row.bal) + "</td></tr>";
          });
          body.innerHTML = html;
        }
        bind(["loanAmount","loanAmountNum"], calcLoan);
        bind(["loanRate","loanRateNum"], calcLoan);
        bind(["loanYears","loanYearsNum"], calcLoan);
        bind(["loanExtra","loanExtraNum"], calcLoan);

        /* ---------------- Compound interest ---------------- */
        function calcCompound(){
          var P = Math.max(0, num("compPrincipalNum"));
          var monthly = Math.max(0, num("compMonthlyNum"));
          var rate = Math.max(0, num("compRateNum")) / 100;
          var years = Math.max(0, Math.round(num("compYearsNum")));
          var m = parseInt(document.getElementById("compFreq").value, 10) || 12;
          var bal = P, contributed = P;
          /* Precise period-by-period computation: deposits spread evenly
             across the periods of each year, growth applied per period. */
          var perRate = rate / m, periodsPerYear = m, totalPeriods = Math.round(m * years);
          var monthsPerPeriod = 12 / m;
          var depPerPeriod = monthly * monthsPerPeriod;
          var yearEnd = [];
          for (var p = 1; p <= totalPeriods; p++) {
            bal += depPerPeriod; contributed += depPerPeriod;
            bal *= (1 + perRate);
            if (p % periodsPerYear === 0) yearEnd.push({ year: p / periodsPerYear, bal: bal, contrib: contributed });
          }
          var growth = bal - contributed;
          setText("compFuture", fmt(bal));
          setText("compContribOut", fmt(contributed));
          setText("compInterestOut", fmt(Math.max(0, growth)));
          setText("compShareOut", bal > 0 ? Math.round(Math.max(0, growth) / bal * 100) + "%" : "0%");
          /* table */
          var tbody = document.getElementById("compTableBody");
          if (!tbody) return;
          var thtml = "";
          yearEnd.forEach(function(rw){
            thtml += "<tr><td>" + rw.year + "</td><td>" + fmtNum(rw.contrib) + "</td><td>" + fmtNum(Math.max(0, rw.bal - rw.contrib)) + "</td><td>" + fmtNum(rw.bal) + "</td></tr>";
          });
          tbody.innerHTML = thtml;
          /* chart */
          var svg = document.getElementById("compChart");
          var W = 640, H = 280, padL = 8, padR = 8, padT = 24, padB = 30;
          var maxV = bal > 0 ? bal : 1;
          var all = [{ x: 0, bal: P, contrib: P }].concat(yearEnd.map(function(rw){ return { x: rw.year, bal: rw.bal, contrib: rw.contrib }; }));
          function X(x){ return padL + (W - padL - padR) * (years > 0 ? x / years : 0); }
          function Y(v){ return padT + (H - padT - padB) * (1 - v / maxV); }
          var lineBal = "", lineCon = "";
          all.forEach(function(pt, i){
            lineBal += (i === 0 ? "M" : "L") + X(pt.x).toFixed(1) + "," + Y(pt.bal).toFixed(1) + " ";
            lineCon += (i === 0 ? "M" : "L") + X(pt.x).toFixed(1) + "," + Y(pt.contrib).toFixed(1) + " ";
          });
          var area = lineBal + "L" + X(years).toFixed(1) + "," + Y(0).toFixed(1) + " L" + X(0).toFixed(1) + "," + Y(0).toFixed(1) + " Z";
          svg.innerHTML =
            '<path d="' + area + '" fill="var(--accent)" opacity="0.14"></path>' +
            '<path d="' + lineCon + '" fill="none" stroke="var(--chart-b)" stroke-width="2.5"></path>' +
            '<path d="' + lineBal + '" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>' +
            '<text x="' + padL + '" y="16" font-size="13" fill="var(--muted)">Peak: ' + fmtShort(maxV) + '</text>' +
            '<text x="' + padL + '" y="' + (H - 8) + '" font-size="13" fill="var(--muted)">Year 0</text>' +
            '<text x="' + (W - padR) + '" y="' + (H - 8) + '" font-size="13" fill="var(--muted)" text-anchor="end">Year ' + years + '</text>';
        }
        bind(["compPrincipal","compPrincipalNum"], calcCompound);
        bind(["compMonthly","compMonthlyNum"], calcCompound);
        bind(["compRate","compRateNum"], calcCompound);
        bind(["compYears","compYearsNum"], calcCompound);
        var cf = document.getElementById("compFreq"); if (cf) cf.addEventListener("change", calcCompound);

        /* ---------------- Savings goal ---------------- */
        function calcSavings(){
          var goal = Math.max(0, num("savGoalNum"));
          var current = Math.max(0, num("savCurrentNum"));
          var monthly = Math.max(0, num("savMonthlyNum"));
          var r = Math.max(0, num("savRateNum")) / 1200;
          var targetYears = Math.max(1, num("savTargetYearsNum"));
          /* months to goal */
          var bal = current, months = 0, deposits = current;
          if (bal < goal) {
            if (monthly <= 0 && r <= 0) { months = Infinity; }
            else {
              while (bal < goal && months < 1200) {
                bal += monthly; deposits += monthly;
                bal *= (1 + r);
                months++;
              }
              if (bal < goal) months = Infinity;
            }
          }
          if (isFinite(months)) {
            setText("savTime", months === 0 ? "Already there" : monthsText(months));
            var d = new Date(); d.setMonth(d.getMonth() + months);
            setText("savDateOut", months === 0 ? "Today" : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }));
            setText("savDepositsOut", fmt(deposits));
            setText("savGrowthOut", fmt(Math.max(0, bal - deposits)));
          } else {
            setText("savTime", "Not on this path");
            setText("savDateOut", "—");
            setText("savDepositsOut", "—");
            setText("savGrowthOut", "—");
          }
          /* required monthly for target date: PMT-style solve on FV of annuity + current growth */
          var nT = Math.round(targetYears * 12);
          var grownCurrent = current * Math.pow(1 + r, nT);
          var remaining = goal - grownCurrent;
          var need;
          if (remaining <= 0) need = 0;
          else if (r === 0) need = remaining / nT;
          else need = remaining * r / (Math.pow(1 + r, nT) - 1) / (1 + r);
          setText("savNeededOut", fmt(Math.max(0, need)) + " / month");
          /* progress */
          var pct = goal > 0 ? Math.min(100, current / goal * 100) : 0;
          var pb = document.getElementById("savProgressBar"); if (pb) pb.style.width = pct.toFixed(1) + "%";
          setText("savProgressText", fmt(current) + " of " + fmt(goal) + " saved (" + pct.toFixed(1) + "%)");
        }
        bind(["savGoal","savGoalNum"], calcSavings);
        bind(["savCurrent","savCurrentNum"], calcSavings);
        bind(["savMonthly","savMonthlyNum"], calcSavings);
        bind(["savRate","savRateNum"], calcSavings);
        bind(["savTargetYears","savTargetYearsNum"], calcSavings);

        /* ---------------- Currency + contact ---------------- */
        var cs = document.getElementById("currencySel"); if (cs) cs.addEventListener("change", function(){
          currency = this.value;
          if (document.getElementById("emiAmountNum")) calcEmi();
        if (document.getElementById("loanAmountNum")) calcLoan();
        if (document.getElementById("compPrincipalNum")) calcCompound();
        if (document.getElementById("savGoalNum")) calcSavings();
        });
        var cf2 = document.getElementById("contactForm"); if (cf2) cf2.addEventListener("submit", function(ev){
          ev.preventDefault();
          var name = document.getElementById("cfName").value.trim();
          var subj = document.getElementById("cfSubject").value.trim();
          var msg = document.getElementById("cfMsg").value.trim();
          var body = encodeURIComponent(msg + "\n\n— " + name);
          window.location.href = "mailto:ub7214715@gmail.com?subject=" + encodeURIComponent(subj) + "&body=" + body;
          document.getElementById("cfStatus").textContent = "Your email app should now open with the message ready to send.";
        });

        if (document.getElementById("emiAmountNum")) calcEmi();
        if (document.getElementById("loanAmountNum")) calcLoan();
        if (document.getElementById("compPrincipalNum")) calcCompound();
        if (document.getElementById("savGoalNum")) calcSavings();
      })();
    