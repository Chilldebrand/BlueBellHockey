import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, InstancedMesh, Object3D, type Group } from "three";
import type { WorldEvent } from "@bbh/arcade-core";
import type { ArenaLayout, StandSpec } from "./arenaLayout.js";
import type {
  ApparelKind,
  CrowdDetail,
  CrowdSpec,
  SpectatorInstance
} from "./crowdGeneration.js";
import {
  advanceCrowdReaction,
  createCrowdReactionState,
  reactionProgress,
  type CrowdReactionState
} from "./crowdReaction.js";

export interface CrowdProps {
  readonly spec: CrowdSpec;
  readonly layout: ArenaLayout;
  readonly events: readonly WorldEvent[];
  readonly nowMs: number;
  readonly detail: CrowdDetail;
}

/** Body silhouette proportions per apparel kind (unit box, scaled per fan). */
const BODY_DIMS: Record<ApparelKind, readonly [number, number, number]> = {
  jersey: [17, 20, 11],
  hoodie: [16, 22, 12],
  jacket: [20, 19, 13],
  street: [14, 21, 10]
};

const HEAD_RADIUS = 5.2;
/** Deterministic per-section animation phase offsets (stand order is fixed). */
const SECTION_PHASES = [0, 0.31, 0.58, 0.83] as const;
const IDLE_BOB_UNITS = 1.6;
const GOAL_RISE_UNITS = 9;
const GOAL_PULSE_UNITS = 11;
const HIT_POP_UNITS = 12;

function bodyHeight(fan: SpectatorInstance): number {
  return BODY_DIMS[fan.apparel][1] * fan.scaleY;
}

/**
 * Instanced spectators for one stand section. Matrices are written once from
 * the deterministic crowd spec; the parent group is what animates.
 */
function StandCrowdSection({
  stand,
  fans,
  detail,
  registerGroup
}: {
  readonly stand: StandSpec;
  readonly fans: readonly SpectatorInstance[];
  readonly detail: CrowdDetail;
  readonly registerGroup: (group: Group | null) => void;
}): JSX.Element {
  const headsRef = useRef<InstancedMesh>(null);
  const bodiesRef = useRef<InstancedMesh>(null);
  const accessoriesRef = useRef<InstancedMesh>(null);
  const accessorized = useMemo(
    () => fans.filter((fan) => fan.accessory !== "none"),
    [fans]
  );

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const color = new Color();
    const heads = headsRef.current;
    const bodies = bodiesRef.current;
    const accessories = accessoriesRef.current;

    if (bodies) {
      fans.forEach((fan, index) => {
        const dims = BODY_DIMS[fan.apparel];
        dummy.position.set(
          fan.position.x,
          fan.position.y + (dims[1] * fan.scaleY) / 2,
          fan.position.z
        );
        dummy.rotation.set(0, fan.rotationY, 0);
        dummy.scale.set(
          dims[0] * fan.scaleXZ,
          dims[1] * fan.scaleY,
          dims[2] * fan.scaleXZ
        );
        dummy.updateMatrix();
        bodies.setMatrixAt(index, dummy.matrix);
        bodies.setColorAt(index, color.set(fan.apparelColor));
      });
      bodies.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) {
        bodies.instanceColor.needsUpdate = true;
      }
    }

    if (heads) {
      fans.forEach((fan, index) => {
        const scale = HEAD_RADIUS * fan.scaleXZ;
        dummy.position.set(
          fan.position.x,
          fan.position.y + bodyHeight(fan) + HEAD_RADIUS * 0.9,
          fan.position.z
        );
        dummy.rotation.set(0, fan.rotationY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        heads.setMatrixAt(index, dummy.matrix);
        heads.setColorAt(index, color.set(fan.skinTone));
      });
      heads.instanceMatrix.needsUpdate = true;
      if (heads.instanceColor) {
        heads.instanceColor.needsUpdate = true;
      }
    }

    if (accessories) {
      accessorized.forEach((fan, index) => {
        const headTop =
          fan.position.y + bodyHeight(fan) + HEAD_RADIUS * 0.9 + HEAD_RADIUS;
        if (fan.accessory === "scarf") {
          dummy.position.set(
            fan.position.x,
            fan.position.y + bodyHeight(fan) - 1.5,
            fan.position.z
          );
          dummy.scale.set(6.5 * fan.scaleXZ, 1.6, 6.5 * fan.scaleXZ);
        } else if (fan.accessory === "cap") {
          dummy.position.set(fan.position.x, headTop - 1.5, fan.position.z);
          dummy.scale.set(5.6 * fan.scaleXZ, 1.4, 5.6 * fan.scaleXZ);
        } else {
          dummy.position.set(fan.position.x, headTop - 0.5, fan.position.z);
          dummy.scale.set(4.6 * fan.scaleXZ, 2.4, 4.6 * fan.scaleXZ);
        }
        dummy.rotation.set(0, fan.rotationY, 0);
        dummy.updateMatrix();
        accessories.setMatrixAt(index, dummy.matrix);
        accessories.setColorAt(index, color.set(fan.apparelColor));
      });
      accessories.instanceMatrix.needsUpdate = true;
      if (accessories.instanceColor) {
        accessories.instanceColor.needsUpdate = true;
      }
    }
  }, [fans, accessorized]);

  return (
    <group name={`crowd-${stand.id}`} ref={registerGroup}>
      <instancedMesh
        ref={bodiesRef}
        args={[undefined!, undefined!, fans.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={headsRef}
        args={[undefined!, undefined!, fans.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {detail === "full" && accessorized.length > 0 ? (
        <instancedMesh
          ref={accessoriesRef}
          args={[undefined!, undefined!, accessorized.length]}
          frustumCulled={false}
        >
          <cylinderGeometry args={[1, 1, 1, 8]} />
          <meshStandardMaterial roughness={0.9} />
        </instancedMesh>
      ) : null}
    </group>
  );
}

/**
 * The whole bowl's spectators: one section group per stand, animated as units
 * (idle sway plus goal/knockdown reactions) so normal frames never touch a
 * per-fan instance matrix.
 */
export function Crowd({
  spec,
  layout,
  events,
  nowMs,
  detail
}: CrowdProps): JSX.Element {
  const fansByStand = useMemo(() => {
    const byStand = new Map<string, SpectatorInstance[]>();
    for (const fan of spec.spectators) {
      const list = byStand.get(fan.standId);
      if (list) {
        list.push(fan);
      } else {
        byStand.set(fan.standId, [fan]);
      }
    }
    return byStand;
  }, [spec]);

  const reactionRef = useRef<CrowdReactionState>(createCrowdReactionState());
  const sectionGroups = useRef<(Group | null)[]>([null, null, null, null]);

  useFrame(() => {
    const state = advanceCrowdReaction(reactionRef.current, events, nowMs);
    reactionRef.current = state;
    const progress = reactionProgress(state, nowMs);

    for (let index = 0; index < layout.stands.length; index += 1) {
      const group = sectionGroups.current[index];
      if (!group) {
        continue;
      }

      const phase = SECTION_PHASES[index] ?? 0;
      let lift = 0;

      // Continuous idle motion is a full-detail nicety; reduced detail keeps
      // the crowd still between reactions.
      if (detail === "full") {
        lift += Math.sin(nowMs / 900 + phase * Math.PI * 2) * IDLE_BOB_UNITS;
      }

      if (progress !== null && state.active) {
        if (state.active.kind === "goal") {
          // Staggered two-pulse celebration: each section trails slightly.
          const local = Math.max(0, Math.min(1, progress - phase * 0.06));
          lift += Math.sin(local * Math.PI) * GOAL_RISE_UNITS;
          lift += Math.abs(Math.sin(local * Math.PI * 2)) * GOAL_PULSE_UNITS;
        } else {
          const local = Math.max(0, Math.min(1, progress - phase * 0.04));
          lift += Math.sin(local * Math.PI) * HIT_POP_UNITS;
        }
      }

      group.position.y = lift;
    }
  });

  return (
    <group name="arena-crowd">
      {layout.stands.map((stand, index) => (
        <StandCrowdSection
          key={stand.id}
          stand={stand}
          fans={fansByStand.get(stand.id) ?? []}
          detail={detail}
          registerGroup={(group) => {
            sectionGroups.current[index] = group;
          }}
        />
      ))}
    </group>
  );
}
