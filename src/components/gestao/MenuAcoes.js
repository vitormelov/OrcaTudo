import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from 'react-bootstrap';
import { FaEllipsisV } from 'react-icons/fa';

const MARGEM = 8;

/**
 * Menu de ações (⋮) para linhas de tabela.
 * Renderizado no <body> com posição fixa calculada a partir do botão
 * (o app rola o <body>, não a janela, o que confunde o posicionamento automático).
 * Abre à esquerda do botão; se não couber abaixo, abre para cima. Fecha ao
 * clicar fora, ao rolar, ao redimensionar ou com Esc.
 * `acoes`: [{ label, icon, onClick }]
 */
function MenuAcoes({ acoes }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const botaoRef = useRef(null);
  const menuRef = useRef(null);

  const fechar = useCallback(() => {
    setAberto(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current || !menuRef.current) return;
    const b = botaoRef.current.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = menuRef.current;
    let left = b.left - w - 4;
    if (left < MARGEM) left = Math.min(b.right + 4, window.innerWidth - w - MARGEM);
    let top = b.top;
    if (top + h > window.innerHeight - MARGEM) top = b.bottom - h;
    top = Math.max(MARGEM, Math.min(top, window.innerHeight - h - MARGEM));
    setPos({ left: Math.max(MARGEM, left), top });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (menuRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      fechar();
    };
    const rolou = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      fechar();
    };
    const tecla = (e) => e.key === 'Escape' && fechar();
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    document.addEventListener('scroll', rolou, true);
    window.addEventListener('resize', fechar);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('touchstart', fora);
      document.removeEventListener('scroll', rolou, true);
      window.removeEventListener('resize', fechar);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto, fechar]);

  return (
    <>
      <Button
        ref={botaoRef}
        size="sm"
        variant="outline-secondary"
        className="gestao-acoes-btn"
        title="Ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        <FaEllipsisV />
      </Button>
      {aberto && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="gestao-menu-acoes dropdown-menu show"
          style={{
            position: 'fixed',
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos ? 'visible' : 'hidden'
          }}
        >
          {acoes.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className="dropdown-item d-flex align-items-center"
              onClick={() => {
                fechar();
                a.onClick();
              }}
            >
              {a.icon && <span className="me-2 d-inline-flex">{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default MenuAcoes;
