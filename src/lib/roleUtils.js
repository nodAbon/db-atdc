export function isLeaderPosition(position) {
  if (!position) return false;
  const p = String(position).trim();
  return p.includes('팀장') || p.includes('실장') || p.includes('본부장') || p.includes('센터장') || p.includes('부서장');
}

export function isExecutivePosition(position) {
  if (!position) return false;
  const p = String(position).trim();
  return p.includes('임원') || p.includes('대표') || p.includes('이사') || p.includes('상무') || p.includes('전무') || p.includes('부사장') || p.includes('사장');
}
