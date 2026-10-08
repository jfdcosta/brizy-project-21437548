export function inspectGeometry(geometry, maxDimensionMm = 250) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  const count = indices ? indices.count : positions?.count;
  if (!positions || positions.itemSize !== 3 || !count || count % 3 !== 0) {
    throw new Error('This STL has no usable triangles.');
  }
  const triangles = count / 3;
  if (triangles > 250000) throw new Error('This STL is too detailed for the browser preview.');

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let sixTimesVolume = 0;
  const point = (position) => {
    const vertex = indices ? indices.getX(position) : position;
    const values = [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)];
    values.forEach((value, axis) => {
      if (!Number.isFinite(value)) throw new Error('This STL contains invalid coordinates.');
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    });
    return values;
  };
  for (let position = 0; position < count; position += 3) {
    const [ax, ay, az] = point(position);
    const [bx, by, bz] = point(position + 1);
    const [cx, cy, cz] = point(position + 2);
    sixTimesVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  const dimensions = max.map((value, axis) => value - min[axis]);
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('This STL has no measurable three-dimensional size.');
  }
  if (dimensions.some((value) => value > maxDimensionMm)) {
    throw new Error(`The model exceeds the ${maxDimensionMm} mm preview envelope. Split it into smaller parts for review.`);
  }
  return {
    dimensionsMm: dimensions,
    volumeCm3: Math.abs(sixTimesVolume) / 6000,
    triangles,
  };
}
