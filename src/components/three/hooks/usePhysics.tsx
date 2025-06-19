import { useState, useCallback, useRef, useEffect } from 'react';
import { RapierRigidBody } from '@react-three/rapier';

export function usePhysics() {
  const [bodies, setBodies] = useState<Map<string, RapierRigidBody>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const registerBody = useCallback((id: string, body: RapierRigidBody) => {
    setBodies(prev => {
      const next = new Map(prev);
      next.set(id, body);
      return next;
    });
  }, []);

  const applyImpulse = useCallback((id: string, force: { x: number, y: number, z: number }) => {
    const body = bodies.get(id);
    if (body) {
      body.applyImpulse(force, true);
    }
  }, [bodies]);

  const resetBodies = useCallback(() => {
    bodies.forEach(body => {
      const randomX = Math.random() * 6 - 3;
      const randomZ = Math.random() * 6 - 3;
      body.setTranslation({ x: randomX, y: 5, z: randomZ }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });
  }, [bodies]);

  const handleCollision = useCallback((id: string, callback: () => void) => {
    if (timeoutRef.current) return;
    
    callback();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
    }, 500);
  }, []);

  return {
    registerBody,
    applyImpulse,
    resetBodies,
    handleCollision,
  };
} 