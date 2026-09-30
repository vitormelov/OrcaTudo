import React, { useMemo } from 'react';
import { Form } from 'react-bootstrap';

/** Select dos itens da gestão agrupados por pacote da EAP. */
function ItemSelect({ itens, value, onChange, size, isInvalid, placeholder = 'Selecione o item...', excluirId, ...rest }) {
  const grupos = useMemo(() => {
    const mapa = new Map();
    (itens || []).forEach((it) => {
      if (it.id === excluirId) return;
      if (it.removido && it.id !== value) return;
      const pacote = it.pacoteNome || 'Sem pacote';
      // itens de aditivo ficam agrupados sob o nome do aditivo
      const chave = it.prefixo ? `${it.secaoNome} › ${pacote}` : pacote;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(it);
    });
    return [...mapa.entries()];
  }, [itens, value, excluirId]);

  return (
    <Form.Select
      size={size}
      value={value || ''}
      isInvalid={isInvalid}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      <option value="">{placeholder}</option>
      {grupos.map(([pacote, lista]) => (
        <optgroup key={pacote} label={pacote}>
          {lista.map((it) => (
            <option key={it.id} value={it.id}>
              {it.numero} — {it.codigo ? `${it.codigo} · ` : ''}{it.descricao}{it.removido ? ' (removido do orçamento)' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </Form.Select>
  );
}

export default ItemSelect;
