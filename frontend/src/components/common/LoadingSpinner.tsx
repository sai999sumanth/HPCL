import React from 'react';
import styled, { keyframes } from 'styled-components';

const stretchDelay = keyframes`
  0%, 40%, 100% {
    transform: scaleY(0.4);
  }
  20% {
    transform: scaleY(1.0);
  }
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  height: 100vh;
  width: 100%;
`;

const Spinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  width: 100px;
`;

const Rect = styled.div`
  background-color: lightblue;
  height: 100%;
  width: 10px;
  margin: 0 3px;
  animation: ${stretchDelay} 1.2s infinite ease-in-out;
`;

const LoadingSpinner: React.FC = () => {
  return (
    <Container>
      <Spinner>
        {[...Array(7)].map((_, index) => (
          <Rect key={index} style={{ animationDelay: `${-1.1 + index * 0.1}s` }} />
        ))}
      </Spinner>
    </Container>
  );
};

export default LoadingSpinner;