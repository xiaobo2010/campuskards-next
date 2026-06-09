/** Client-side helpers mirroring backend choice branch rules. */

export function branchNeedsTarget(branchText: string): boolean {
  if (branchText.includes("随机") || branchText.includes("任意目标")) {
    return false;
  }
  const patterns = [
    /对.*?单位.*?造成/,
    /对一个.*?造成/,
    /使一个单位/,
    /进入一个单位/,
  ];
  return patterns.some((p) => p.test(branchText));
}
