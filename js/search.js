let currentSearchQuery = '';
let catalogFilters = { league: 'all', team: 'all' };
let currentPage = 1;

function filterProducts() {
  let filtered = [...PRODUCTS];
  
  if (currentSearchQuery.trim().length >= 2) {
    const q = currentSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.club.toLowerCase().includes(q) ||
      p.kit.toLowerCase().includes(q) ||
      (LEAGUE_BY_CLUB[p.club] && LEAGUE_BY_CLUB[p.club].toLowerCase().includes(q))
    );
  }
  
  if (catalogFilters.league !== 'all') {
    filtered = filtered.filter(p => LEAGUE_BY_CLUB[p.club] === catalogFilters.league);
  }
  
  if (catalogFilters.team !== 'all') {
    filtered = filtered.filter(p => p.club === catalogFilters.team);
  }
  
  return filtered.sort((a, b) => a.id - b.id);
}

function getPaginatedProducts() {
  const filtered = filterProducts();
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return {
    products: filtered.slice(start, end),
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
    currentPage
  };
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchQuery = e.target.value;
      currentPage = 1;
      updateResultsCount();
      renderGrid();
      updatePagination();
    }, 300);
  });
  
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      currentSearchQuery = '';
      currentPage = 1;
      renderGrid();
      updatePagination();
      updateResultsCount();
    }
  });
}

function updateResultsCount() {
  const countEl = document.getElementById('searchResultsCount');
  if (!countEl) return;
  
  const { total } = getPaginatedProducts();
  let message = '';
  
  if (currentSearchQuery.trim().length >= 2) {
    message = `Found ${total} result${total !== 1 ? 's' : ''} for "${escapeHtml(currentSearchQuery)}"`;
  } else if (catalogFilters.league !== 'all' || catalogFilters.team !== 'all') {
    message = `${total} product${total !== 1 ? 's' : ''} available`;
  } else {
    message = `${PRODUCTS.length} products in collection`;
  }
  
  countEl.textContent = message;
}

function setupCatalogFilters() {
  const leagueFilter = document.getElementById('leagueFilter');
  const teamFilter = document.getElementById('teamFilter');
  
  if (!leagueFilter || !teamFilter) return;
  
  const leagues = getAllLeagues();
  leagues.forEach(league => {
    const opt = document.createElement('option');
    opt.value = league;
    opt.textContent = league;
    leagueFilter.appendChild(opt);
  });
  
  function populateTeamFilter(league) {
    const teams = getTeamsByLeague(league).sort();
    teamFilter.innerHTML = '<option value="all">All teams</option>';
    teamFilter.disabled = teams.length === 0;
    if (teams.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'none';
      opt.disabled = true;
      opt.textContent = 'No teams available';
      teamFilter.appendChild(opt);
    } else {
      teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team;
        opt.textContent = team;
        teamFilter.appendChild(opt);
      });
    }
  }
  
  populateTeamFilter('all');
  
  leagueFilter.addEventListener('change', (e) => {
    catalogFilters.league = e.target.value;
    catalogFilters.team = 'all';
    currentPage = 1;
    populateTeamFilter(catalogFilters.league);
    updateResultsCount();
    renderGrid();
    updatePagination();
  });
  
  teamFilter.addEventListener('change', (e) => {
    catalogFilters.team = e.target.value;
    currentPage = 1;
    updateResultsCount();
    renderGrid();
    updatePagination();
  });
}

function setupPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.id = 'pagePrev';
  prevBtn.textContent = '← Prev';
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.id = 'pageNext';
  nextBtn.textContent = 'Next →';
  
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.id = 'paginationInfo';
  
  container.innerHTML = '';
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);
  container.appendChild(info);
  
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
      updatePagination();
      window.scrollTo({ top: document.getElementById('shop')?.offsetTop - 100, behavior: 'smooth' });
    }
  });
  
  nextBtn.addEventListener('click', () => {
    const { totalPages } = getPaginatedProducts();
    if (currentPage < totalPages) {
      currentPage++;
      renderGrid();
      updatePagination();
      window.scrollTo({ top: document.getElementById('shop')?.offsetTop - 100, behavior: 'smooth' });
    }
  });
}

function updatePagination() {
  const container = document.getElementById('pagination');
  if (!container) return;
  
  const { total, totalPages } = getPaginatedProducts();
  const prevBtn = document.getElementById('pagePrev');
  const nextBtn = document.getElementById('pageNext');
  const info = document.getElementById('paginationInfo');
  
  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  
  info.textContent = `Page ${currentPage} of ${totalPages} (${total} products)`;
  
  const pagesContainer = document.getElementById('pagesContainer');
  if (pagesContainer) pagesContainer.remove();
  
  const pagesDiv = document.createElement('div');
  pagesDiv.id = 'pagesContainer';
  pagesDiv.style.display = 'flex';
  pagesDiv.style.gap = '4px';
  
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      currentPage = i;
      renderGrid();
      updatePagination();
      window.scrollTo({ top: document.getElementById('shop')?.offsetTop - 100, behavior: 'smooth' });
    });
    pagesDiv.appendChild(pageBtn);
  }
  
  container.insertBefore(pagesDiv, nextBtn);
}
